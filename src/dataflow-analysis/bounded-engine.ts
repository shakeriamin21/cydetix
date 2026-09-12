import traverse, { type NodePath } from "@babel/traverse";
import type {
  ArgumentPlaceholder,
  CallExpression,
  Expression,
  Function as BabelFunction,
  Node,
  ObjectExpression,
  SpreadElement,
} from "@babel/types";

import type { ParsedSource } from "../ast-analysis/parser.js";
import type { AnalysisCompleteness, FindingProof, RemediationReasonCode } from "../core/schema.js";
import { pointAt } from "../rule-engine/finding.js";
import type { SourceFile } from "../repository-discovery/traverse.js";
import type { SecurityIr } from "../security-ir/model.js";
import {
  applicationDataflowAnalysisSchema,
  type ApplicationDataflowAnalysis,
  type ApplicationDataflowKind,
} from "./model.js";

const MAX_AST_NODES_PER_FILE = 50_000;
const MAX_REPOSITORY_AST_NODES = 200_000;
const MAX_FACTS = 10_000;
const MAX_ITERATIONS = 8;
const MAX_EVIDENCE_STEPS = 16;

const ROUTE_METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);
const SQL_MODULES = new Set([
  "pg",
  "mysql",
  "mysql2",
  "sqlite3",
  "better-sqlite3",
  "sequelize",
  "knex",
  "@prisma/client",
]);
const COMMAND_MODULES = new Set(["child_process", "node:child_process"]);
const FILESYSTEM_MODULES = new Set(["fs", "node:fs", "fs/promises", "node:fs/promises"]);
const HTTP_MODULES = new Set(["axios", "got", "node-fetch", "undici"]);
const REDIRECT_MODULES = new Set(["next/navigation", "next/server"]);

function splitPythonTopLevelArguments(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let round = 0;
  let square = 0;
  let curly = 0;
  let quote: "'" | '"' | undefined;
  let triple = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote !== undefined) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (triple && text.slice(index, index + 3) === quote.repeat(3)) {
        index += 2;
        quote = undefined;
        triple = false;
      } else if (!triple && character === quote) {
        quote = undefined;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      triple = text.slice(index, index + 3) === character.repeat(3);
      if (triple) index += 2;
      continue;
    }
    if (character === "(") round += 1;
    else if (character === ")") round = Math.max(0, round - 1);
    else if (character === "[") square += 1;
    else if (character === "]") square = Math.max(0, square - 1);
    else if (character === "{") curly += 1;
    else if (character === "}") curly = Math.max(0, curly - 1);
    else if (character === "," && round === 0 && square === 0 && curly === 0) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts;
}

function extractPythonCallArguments(text: string, pattern: RegExp): string | undefined {
  const match = pattern.exec(text);
  if (match?.index === undefined) return undefined;
  const relativeOpen = match[0].lastIndexOf("(");
  if (relativeOpen < 0) return undefined;
  const start = match.index + relativeOpen + 1;
  let depth = 1;
  let quote: "'" | '"' | undefined;
  let triple = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote !== undefined) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (triple && text.slice(index, index + 3) === quote.repeat(3)) {
        index += 2;
        quote = undefined;
        triple = false;
      } else if (!triple && character === quote) {
        quote = undefined;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      triple = text.slice(index, index + 3) === character.repeat(3);
      if (triple) index += 2;
      continue;
    }
    if (character === "(") depth += 1;
    else if (character === ")") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index);
    }
  }
  return undefined;
}

function isPythonStaticStringLiteral(text: string): boolean {
  return /^(?:[rRuUbB]{0,2})?(?:"""[\s\S]*"""|'''[\s\S]*'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')$/.test(
    text.trim(),
  );
}

function pythonUnknownControlBeforeSink(source: string, identifier: string): boolean {
  const escapedIdentifier = identifier.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const calls = /\b([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?)\s*\(([^()\n]*)\)/g;
  const knownNonControls = new Set([
    "dict",
    "float",
    "int",
    "len",
    "list",
    "print",
    "quote",
    "repr",
    "set",
    "str",
    "tuple",
    "urlencode",
    "urlparse",
  ]);
  for (const match of source.matchAll(calls)) {
    const callee = match[1] ?? "";
    const argumentsText = match[2] ?? "";
    if (
      knownNonControls.has(callee) ||
      /^(?:logger|logging)\.(?:debug|info|warning|error|exception|critical)$/.test(callee)
    )
      continue;
    if (new RegExp(`\\b${escapedIdentifier}\\b`).test(argumentsText)) return true;
  }
  return false;
}

interface FlowStep {
  readonly kind: "SOURCE" | "PROPAGATION" | "TRANSFORMATION" | "CONTROL";
  readonly label: string;
  readonly path: string;
  readonly offset: number;
}

interface FlowFact {
  readonly source: FlowStep;
  readonly steps: readonly FlowStep[];
  readonly unknownControl: boolean;
  readonly controls?: readonly ("HTML_ESCAPE" | "HTML_SANITIZE")[];
}

type XssContext = "HTML_BODY" | "HTML_ATTRIBUTE" | "JAVASCRIPT" | "URL" | "RAW_HTML";

interface ImportBinding {
  readonly module: string;
  readonly imported: string;
  readonly bindingStart: number;
}

interface FunctionInfo {
  readonly id: string;
  readonly name: string;
  readonly node: BabelFunction;
  readonly parameters: readonly string[];
  routeRoot: boolean;
  reachable: boolean;
}

export interface DataflowCandidate {
  readonly kind: ApplicationDataflowKind;
  readonly file: SourceFile;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly message: string;
  readonly affectedComponent: string;
  readonly proof: Omit<
    FindingProof,
    "ruleId" | "ruleVersion" | "ruleMaturity" | "cwe" | "asvs" | "owaspTop10"
  >;
  readonly remediationReasons: readonly RemediationReasonCode[];
  readonly fingerprintAnchor: string;
}

export interface DataflowBuildResult {
  readonly analysis: ApplicationDataflowAnalysis;
  readonly candidates: readonly DataflowCandidate[];
}

interface MutableMetrics {
  filesAnalyzed: number;
  astNodesVisited: number;
  factsCreated: number;
  pathsConsidered: number;
  iterations: number;
  truncationEvents: number;
}

function memberPropertyName(node: Node | null | undefined): string | undefined {
  if (node?.type === "Identifier" || node?.type === "PrivateName") {
    return node.type === "Identifier" ? node.name : undefined;
  }
  if (node?.type === "StringLiteral") return node.value;
  return undefined;
}

function memberChain(expression: Node): { root: string; properties: string[] } | undefined {
  if (expression.type === "Identifier") return { root: expression.name, properties: [] };
  if (expression.type !== "MemberExpression" && expression.type !== "OptionalMemberExpression")
    return undefined;
  const parent = memberChain(expression.object);
  const property = memberPropertyName(expression.property);
  if (parent === undefined || property === undefined) return undefined;
  return { root: parent.root, properties: [...parent.properties, property] };
}

function functionName(node: BabelFunction, fallback: string): string {
  if (
    (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") &&
    node.id != null
  )
    return node.id.name;
  return fallback;
}

function parameterNames(node: BabelFunction): string[] {
  return node.params.map((parameter) => {
    if (parameter.type === "Identifier") return parameter.name;
    if (parameter.type === "AssignmentPattern" && parameter.left.type === "Identifier")
      return parameter.left.name;
    return "";
  });
}

function functionId(file: SourceFile, node: BabelFunction): string {
  return `${file.relativePath}:${node.start ?? -1}`;
}

function scopeId(file: SourceFile, path_: NodePath): string {
  const owner = path_.getFunctionParent();
  return owner === null ? `${file.relativePath}:program` : functionId(file, owner.node);
}

function propertyKey(expression: Node): string | undefined {
  const chain = memberChain(expression);
  return chain === undefined ? undefined : `${chain.root}.${chain.properties.join(".")}`;
}

function literalModule(node: Node | null | undefined): string | undefined {
  return node?.type === "StringLiteral" ? node.value : undefined;
}

function requireModule(node: Node | null | undefined): string | undefined {
  if (node?.type !== "CallExpression" || node.callee.type !== "Identifier") return undefined;
  if (node.callee.name !== "require" || node.arguments.length !== 1) return undefined;
  return literalModule(node.arguments[0]);
}

function importedBinding(
  imports: ReadonlyMap<string, ImportBinding>,
  name: string,
  modules: ReadonlySet<string>,
  path_: NodePath<CallExpression>,
): ImportBinding | undefined {
  const binding = imports.get(name);
  const lexicalStart = path_.scope.getBinding(name)?.path.node.start;
  return binding !== undefined &&
    modules.has(binding.module) &&
    lexicalStart === binding.bindingStart
    ? binding
    : undefined;
}

function appendStep(
  fact: FlowFact,
  step: FlowStep,
  unknownControl = fact.unknownControl,
): FlowFact {
  const steps = [...fact.steps, step].slice(0, MAX_EVIDENCE_STEPS);
  return {
    source: fact.source,
    steps,
    unknownControl,
    ...(fact.controls === undefined ? {} : { controls: fact.controls }),
  };
}

function appendControl(
  fact: FlowFact,
  control: NonNullable<FlowFact["controls"]>[number],
  step: FlowStep,
): FlowFact {
  return {
    source: fact.source,
    steps: [...fact.steps, step].slice(0, MAX_EVIDENCE_STEPS),
    unknownControl: fact.unknownControl,
    controls: [...new Set([...(fact.controls ?? []), control])],
  };
}

function deterministicFact(facts: readonly (FlowFact | undefined)[]): FlowFact | undefined {
  const available = facts.filter((fact): fact is FlowFact => fact !== undefined);
  available.sort((left, right) => {
    const length = left.steps.length - right.steps.length;
    return length === 0
      ? `${left.source.path}:${left.source.offset}:${left.source.label}`.localeCompare(
          `${right.source.path}:${right.source.offset}:${right.source.label}`,
        )
      : length;
  });
  return available[0];
}

function expressionArguments(
  call: CallExpression,
): Array<Expression | SpreadElement | ArgumentPlaceholder> {
  return [...call.arguments];
}

function objectPropertyValue(object: ObjectExpression, name: string): Expression | undefined {
  for (const property of object.properties) {
    if (property.type !== "ObjectProperty") continue;
    const key = memberPropertyName(property.key);
    if (key !== name || property.value.type === "AssignmentPattern") continue;
    if (property.value.type === "RestElement") continue;
    return property.value as Expression;
  }
  return undefined;
}

function isTrueProperty(object: ObjectExpression | undefined, name: string): boolean {
  const value = object === undefined ? undefined : objectPropertyValue(object, name);
  return value?.type === "BooleanLiteral" && value.value;
}

function isStaticString(node: Node | null | undefined): boolean {
  return (
    node?.type === "StringLiteral" ||
    (node?.type === "TemplateLiteral" && node.expressions.length === 0)
  );
}

function rootIdentifier(node: Node | null | undefined): string | undefined {
  if (node?.type === "Identifier") return node.name;
  if (node?.type === "MemberExpression" || node?.type === "OptionalMemberExpression") {
    return rootIdentifier(node.object);
  }
  return undefined;
}

function xssTemplateContext(expression: Node | null | undefined): XssContext {
  if (expression?.type !== "TemplateLiteral" || expression.expressions.length === 0)
    return "RAW_HTML";
  const prefix = expression.quasis[0]?.value.cooked ?? expression.quasis[0]?.value.raw ?? "";
  const lower = prefix.toLowerCase();
  if (lower.lastIndexOf("<script") > lower.lastIndexOf("</script")) return "JAVASCRIPT";
  if (/(?:href|src|action|formaction)\s*=\s*["'][^"']*$/iu.test(prefix)) return "URL";
  if (/[A-Za-z_:][-A-Za-z0-9_:.]*\s*=\s*["'][^"']*$/u.test(prefix)) return "HTML_ATTRIBUTE";
  return "HTML_BODY";
}

function xssControlEvaluation(
  fact: FlowFact,
  context: XssContext,
): "ABSENT" | "RECOGNIZED_EFFECTIVE" | "RECOGNIZED_INEFFECTIVE" {
  const controls = fact.controls ?? [];
  if (controls.length === 0) return "ABSENT";
  const effective = controls.some(
    (control) =>
      (control === "HTML_ESCAPE" &&
        ["HTML_BODY", "HTML_ATTRIBUTE", "RAW_HTML"].includes(context)) ||
      (control === "HTML_SANITIZE" && ["HTML_BODY", "RAW_HTML"].includes(context)),
  );
  return effective ? "RECOGNIZED_EFFECTIVE" : "RECOGNIZED_INEFFECTIVE";
}

function redirectPolicyEnforced(source: string, destination: Node, sinkOffset: number): boolean {
  const name = rootIdentifier(destination);
  if (name === undefined) return false;
  const escaped = name.replaceAll(/[$]/g, "\\$");
  const before = source.slice(0, sinkOffset);
  const parsed = new RegExp(`(?:const|let|var)\\s+${escaped}\\s*=\\s*new\\s+URL\\s*\\(`).test(
    before,
  );
  const exactHostGuard = new RegExp(
    `if\\s*\\([^\\n]*!\\s*(?:ALLOWED_REDIRECT_HOSTS|allowedRedirectHosts|allowed_redirect_hosts)\\.has\\s*\\(\\s*${escaped}\\.hostname\\s*\\)[^\\n]*\\)[^\\n]*(?:return|throw)`,
  ).test(before);
  const exactOriginGuard = new RegExp(
    `if\\s*\\([^\\n]*${escaped}\\.origin\\s*!==\\s*(?:["'][^"']+["']|APP_ORIGIN|appOrigin)[^\\n]*\\)[^\\n]*(?:return|throw)`,
  ).test(before);
  const schemeGuard = new RegExp(
    `if\\s*\\([^\\n]*${escaped}\\.protocol\\s*!==\\s*["']https?:["'][^\\n]*\\)[^\\n]*(?:return|throw)`,
  ).test(before);
  return parsed && ((exactHostGuard && schemeGuard) || exactOriginGuard);
}

function naiveRedirectPrefixCheck(source: string, destination: Node, sinkOffset: number): boolean {
  const name = rootIdentifier(destination);
  if (name === undefined) return false;
  const escaped = name.replaceAll(/[$]/g, "\\$");
  return new RegExp(`${escaped}\\.startsWith\\s*\\(\\s*["']/["']\\s*\\)`).test(
    source.slice(0, sinkOffset),
  );
}

function staticallyUnreachable(path_: NodePath): boolean {
  let child: NodePath = path_;
  for (const ancestor of path_.getAncestry()) {
    if (ancestor.isIfStatement() && ancestor.node.test.type === "BooleanLiteral") {
      if (child.key === "consequent" && !ancestor.node.test.value) return true;
      if (child.key === "alternate" && ancestor.node.test.value) return true;
    }
    if (
      (ancestor.isWhileStatement() || ancestor.isForStatement()) &&
      ancestor.node.test?.type === "BooleanLiteral" &&
      !ancestor.node.test.value
    ) {
      return true;
    }
    child = ancestor;
  }
  return false;
}

function findImports(parsed: Extract<ParsedSource, { language: "javascript" | "typescript" }>): {
  imports: Map<string, ImportBinding>;
  objectOrigins: Map<string, { module: string; bindingStart: number }>;
} {
  const imports = new Map<string, ImportBinding>();
  const objectOrigins = new Map<string, { module: string; bindingStart: number }>();
  traverse(parsed.ast, {
    ImportDeclaration(path_) {
      for (const specifier of path_.node.specifiers) {
        const imported =
          specifier.type === "ImportSpecifier"
            ? (memberPropertyName(specifier.imported) ?? specifier.local.name)
            : specifier.type === "ImportDefaultSpecifier"
              ? "default"
              : "*";
        imports.set(specifier.local.name, {
          module: path_.node.source.value,
          imported,
          bindingStart: specifier.start ?? -1,
        });
      }
    },
    VariableDeclarator(path_) {
      const module = requireModule(path_.node.init);
      if (module !== undefined) {
        if (path_.node.id.type === "Identifier") {
          imports.set(path_.node.id.name, {
            module,
            imported: "*",
            bindingStart: path_.node.start ?? -1,
          });
        } else if (path_.node.id.type === "ObjectPattern") {
          for (const property of path_.node.id.properties) {
            if (property.type === "ObjectProperty" && property.value.type === "Identifier") {
              imports.set(property.value.name, {
                module,
                imported: memberPropertyName(property.key) ?? property.value.name,
                bindingStart: property.start ?? path_.node.start ?? -1,
              });
            }
          }
        }
      }
      if (path_.node.id.type !== "Identifier" || path_.node.init == null) return;
      const initializer = path_.node.init;
      if (initializer.type === "NewExpression" && initializer.callee.type === "Identifier") {
        const origin = imports.get(initializer.callee.name)?.module;
        if (origin !== undefined)
          objectOrigins.set(path_.node.id.name, {
            module: origin,
            bindingStart: path_.node.start ?? -1,
          });
      }
      if (
        initializer.type === "CallExpression" &&
        (initializer.callee.type === "MemberExpression" ||
          initializer.callee.type === "OptionalMemberExpression")
      ) {
        const chain = memberChain(initializer.callee);
        const origin = chain === undefined ? undefined : imports.get(chain.root)?.module;
        if (origin !== undefined)
          objectOrigins.set(path_.node.id.name, {
            module: origin,
            bindingStart: path_.node.start ?? -1,
          });
      }
      if (initializer.type === "CallExpression" && initializer.callee.type === "Identifier") {
        const origin = imports.get(initializer.callee.name)?.module;
        if (origin !== undefined)
          objectOrigins.set(path_.node.id.name, {
            module: origin,
            bindingStart: path_.node.start ?? -1,
          });
      }
    },
  });
  return { imports, objectOrigins };
}

function callDescriptor(
  call: CallExpression,
  imports: ReadonlyMap<string, ImportBinding>,
  objectOrigins: ReadonlyMap<string, { module: string; bindingStart: number }>,
  path_: NodePath<CallExpression>,
): { module?: string; imported?: string; receiver?: string; method?: string } {
  if (call.callee.type === "Identifier") {
    const candidate = imports.get(call.callee.name);
    const binding =
      candidate?.bindingStart === path_.scope.getBinding(call.callee.name)?.path.node.start
        ? candidate
        : undefined;
    return {
      ...(binding === undefined ? {} : { module: binding.module, imported: binding.imported }),
      method: call.callee.name,
    };
  }
  const chain = memberChain(call.callee);
  if (chain === undefined) return {};
  const method = chain.properties.at(-1);
  const lexicalStart = path_.scope.getBinding(chain.root)?.path.node.start;
  const importOrigin = imports.get(chain.root);
  const objectOrigin = objectOrigins.get(chain.root);
  const origin =
    importOrigin !== undefined && importOrigin.bindingStart === lexicalStart
      ? importOrigin.module
      : objectOrigin !== undefined && objectOrigin.bindingStart === lexicalStart
        ? objectOrigin.module
        : undefined;
  return {
    ...(origin === undefined ? {} : { module: origin }),
    receiver: chain.root,
    ...(method === undefined ? {} : { method }),
  };
}

function pathConfined(source: string, expression: Node, sinkOffset: number): boolean {
  if (expression.type !== "Identifier") return false;
  const name = expression.name.replaceAll(/[$]/g, "\\$");
  const before = source.slice(0, sinkOffset);
  const canonical = new RegExp(
    `(?:const|let|var)\\s+${name}\\s*=\\s*(?:path\\.)?resolve\\s*\\(`,
  ).test(before);
  if (!canonical) return false;
  const startsWithBoundary = new RegExp(
    `(?:if\\s*\\(\\s*!${name}\\.startsWith\\s*\\([^)]*(?:path\\.sep|[\\/\\\\]["'])[^)]*\\)\\s*\\)|${name}\\.startsWith\\s*\\([^)]*(?:path\\.sep|[\\/\\\\]["'])[^)]*\\))`,
  ).test(before);
  const relativeBoundary = new RegExp(
    `(?:path\\.)?relative\\s*\\([^,]+,\\s*${name}\\s*\\)[\\s\\S]{0,240}(?:startsWith\\s*\\(\\s*["']\\.\\.["']|isAbsolute)`,
  ).test(before);
  return startsWithBoundary || relativeBoundary;
}

function urlPolicyEnforced(source: string, expression: Node, sinkOffset: number): boolean {
  if (expression.type !== "Identifier") return false;
  const name = expression.name.replaceAll(/[$]/g, "\\$");
  const before = source.slice(0, sinkOffset);
  const parsed = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*new\\s+URL\\s*\\(`).test(before);
  const hostAllowlist = new RegExp(
    `(?:allowedHosts|allowedHostnames|ALLOWED_HOSTS|ALLOWED_HOSTNAMES)\\.has\\s*\\(\\s*${name}\\.hostname\\s*\\)`,
  ).test(before);
  const schemeRestricted = new RegExp(`${name}\\.protocol\\s*(?:===|!==)\\s*["']https:["']`).test(
    before,
  );
  return parsed && hostAllowlist && schemeRestricted;
}

function proofStep(file: SourceFile, step: FlowStep): FindingProof["source"] {
  const point = pointAt(file.text, step.offset);
  return {
    kind: step.kind,
    label: step.label,
    location: { path: step.path, line: point.line, column: point.column },
  };
}

function createCandidate(
  kind: ApplicationDataflowKind,
  file: SourceFile,
  sinkNode: Node,
  fact: FlowFact,
  sinkLabel: string,
  message: string,
  invariant: string,
  controlEvaluation: "ABSENT" | "RECOGNIZED_INEFFECTIVE",
): DataflowCandidate | undefined {
  if (typeof sinkNode.start !== "number" || typeof sinkNode.end !== "number") return undefined;
  const sinkPoint = pointAt(file.text, sinkNode.start);
  return {
    kind,
    file,
    startOffset: sinkNode.start,
    endOffset: sinkNode.end,
    message,
    affectedComponent: sinkLabel,
    proof: {
      schemaVersion: "1.0.0",
      source: proofStep(file, fact.source),
      propagationPath: fact.steps.map((step) => proofStep(file, step)),
      sink: {
        kind: "SINK",
        label: sinkLabel,
        location: { path: file.relativePath, line: sinkPoint.line, column: sinkPoint.column },
      },
      securityControlEncountered: controlEvaluation !== "ABSENT",
      securityControlEvaluation: controlEvaluation,
      reachability: "likely",
      invariant,
      conclusion: `${invariant} is violated by a complete, reachable source-to-sink path.`,
      proofState: "PROVEN_INSECURE",
      analysisLimitations: [
        "The proof is bounded to statically resolved repository-local propagation and the documented sink model.",
      ],
    },
    remediationReasons: ["AMBIGUOUS_SEMANTICS", "VERIFICATION_INSUFFICIENT"],
    fingerprintAnchor: `${kind}:${file.relativePath}:${sinkNode.start}:${fact.source.offset}`,
  };
}

function analyzeJavaScriptFile(
  file: SourceFile,
  parsed: Extract<ParsedSource, { language: "javascript" | "typescript" }>,
  metrics: MutableMetrics,
  unknowns: ApplicationDataflowAnalysis["unknowns"],
): { candidates: DataflowCandidate[]; truncated: boolean } {
  let nodeCount = 0;
  traverse(parsed.ast, {
    enter() {
      nodeCount += 1;
    },
  });
  metrics.astNodesVisited += nodeCount;
  if (nodeCount > MAX_AST_NODES_PER_FILE || metrics.astNodesVisited > MAX_REPOSITORY_AST_NODES) {
    metrics.truncationEvents += 1;
    return { candidates: [], truncated: true };
  }
  metrics.filesAnalyzed += 1;
  const { imports, objectOrigins } = findImports(parsed);
  const shadowedImportNames = new Set<string>();
  const domElementNames = new Set<string>();
  traverse(parsed.ast, {
    Function(path_) {
      for (const parameter of path_.node.params) {
        if (parameter.type === "Identifier" && imports.has(parameter.name))
          shadowedImportNames.add(parameter.name);
      }
    },
    VariableDeclarator(path_) {
      if (path_.node.id.type !== "Identifier") return;
      const imported = imports.get(path_.node.id.name);
      if (imported !== undefined && imported.bindingStart !== path_.node.start)
        shadowedImportNames.add(path_.node.id.name);
      const initializer = path_.node.init;
      if (
        initializer?.type === "CallExpression" &&
        (initializer.callee.type === "MemberExpression" ||
          initializer.callee.type === "OptionalMemberExpression")
      ) {
        const chain = memberChain(initializer.callee);
        if (
          chain?.root === "document" &&
          ["getElementById", "querySelector", "querySelectorAll", "createElement"].includes(
            chain.properties.at(-1) ?? "",
          )
        )
          domElementNames.add(path_.node.id.name);
      }
    },
  });
  const functions = new Map<string, FunctionInfo>();
  const functionNames = new Map<string, string[]>();
  const programId = `${file.relativePath}:program`;
  const registerFunction = (node: BabelFunction, fallback: string): FunctionInfo => {
    const id = functionId(file, node);
    const name = functionName(node, fallback);
    const existing = functions.get(id);
    if (existing !== undefined) return existing;
    const info: FunctionInfo = {
      id,
      name,
      node,
      parameters: parameterNames(node),
      routeRoot: false,
      reachable: false,
    };
    functions.set(id, info);
    const names = functionNames.get(name) ?? [];
    names.push(id);
    functionNames.set(name, names);
    return info;
  };

  traverse(parsed.ast, {
    FunctionDeclaration(path_) {
      registerFunction(path_.node, path_.node.id?.name ?? "anonymous");
    },
    FunctionExpression(path_) {
      const fallback =
        path_.parentPath.isVariableDeclarator() && path_.parentPath.node.id.type === "Identifier"
          ? path_.parentPath.node.id.name
          : "anonymous";
      registerFunction(path_.node, fallback);
    },
    ArrowFunctionExpression(path_) {
      const fallback =
        path_.parentPath.isVariableDeclarator() && path_.parentPath.node.id.type === "Identifier"
          ? path_.parentPath.node.id.name
          : "anonymous";
      registerFunction(path_.node, fallback);
    },
    ObjectMethod(path_) {
      registerFunction(path_.node, memberPropertyName(path_.node.key) ?? "method");
    },
    ClassMethod(path_) {
      registerFunction(path_.node, memberPropertyName(path_.node.key) ?? "method");
    },
  });

  const callEdges = new Map<string, Set<string>>();
  const routeResponseParameters = new Map<string, string>();
  const routeFrameworks = new Map<string, string>();
  const markRouteArgument = (argument: Node | undefined, framework: string): void => {
    if (argument === undefined) return;
    if (argument.type === "FunctionExpression" || argument.type === "ArrowFunctionExpression") {
      const info = functions.get(functionId(file, argument));
      if (info !== undefined) {
        info.routeRoot = true;
        routeFrameworks.set(info.id, framework);
      }
      return;
    }
    if (argument.type === "Identifier") {
      const ids = functionNames.get(argument.name) ?? [];
      if (ids.length === 1) {
        const info = functions.get(ids[0] ?? "");
        if (info !== undefined) {
          info.routeRoot = true;
          routeFrameworks.set(info.id, framework);
        }
      }
    }
  };
  traverse(parsed.ast, {
    CallExpression(path_) {
      const chain = memberChain(path_.node.callee);
      const method = chain?.properties.at(-1)?.toLowerCase();
      const routeLexicalStart =
        chain === undefined ? undefined : path_.scope.getBinding(chain.root)?.path.node.start;
      const routeImport = chain === undefined ? undefined : imports.get(chain.root);
      const routeObject = chain === undefined ? undefined : objectOrigins.get(chain.root);
      const routeModule =
        routeImport !== undefined && routeImport.bindingStart === routeLexicalStart
          ? routeImport.module
          : routeObject !== undefined && routeObject.bindingStart === routeLexicalStart
            ? routeObject.module
            : undefined;
      if (
        method !== undefined &&
        ROUTE_METHODS.has(method) &&
        isStaticString(path_.node.arguments[0]) &&
        routeModule !== undefined &&
        ["express", "fastify"].includes(routeModule)
      ) {
        for (const argument of path_.node.arguments.slice(1))
          markRouteArgument(argument, routeModule);
      }
      if (path_.node.callee.type === "Identifier") {
        const targets = functionNames.get(path_.node.callee.name) ?? [];
        if (targets.length === 1) {
          const owner = scopeId(file, path_);
          const edges = callEdges.get(owner) ?? new Set<string>();
          edges.add(targets[0] ?? "");
          callEdges.set(owner, edges);
        }
      }
    },
    ExportNamedDeclaration(path_) {
      const declaration = path_.node.declaration;
      if (
        declaration?.type === "FunctionDeclaration" &&
        declaration.id != null &&
        ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(declaration.id.name)
      ) {
        const info = functions.get(functionId(file, declaration));
        if (info !== undefined) {
          info.routeRoot = true;
          routeFrameworks.set(info.id, "next");
        }
      }
    },
    ExportDefaultDeclaration(path_) {
      const declaration = path_.node.declaration;
      if (declaration.type === "FunctionDeclaration") {
        const info = functions.get(functionId(file, declaration));
        if (info !== undefined && /(?:^|\/)pages\/api\//.test(file.relativePath)) {
          info.routeRoot = true;
          routeFrameworks.set(info.id, "next");
        }
      }
    },
  });
  for (const info of functions.values()) {
    if (info.routeRoot && info.parameters[1] !== undefined) {
      routeResponseParameters.set(info.id, info.parameters[1]);
    }
  }
  const reachable = new Set<string>([programId]);
  for (const info of functions.values()) if (info.routeRoot) reachable.add(info.id);
  for (let index = 0; index < functions.size + 1; index += 1) {
    let changed = false;
    for (const owner of [...reachable]) {
      for (const target of callEdges.get(owner) ?? []) {
        if (!reachable.has(target)) {
          reachable.add(target);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  for (const info of functions.values()) info.reachable = reachable.has(info.id);

  const facts = new Map<string, FlowFact>();
  const returns = new Map<string, FlowFact>();
  const candidates = new Map<string, DataflowCandidate>();
  const unknownKeys = new Set<string>();
  const key = (scope: string, name: string): string => `${scope}\u0000${name}`;
  const putFact = (scope: string, name: string, fact: FlowFact | undefined): boolean => {
    if (fact === undefined || facts.size >= MAX_FACTS) return false;
    const existing = facts.get(key(scope, name));
    if (existing !== undefined && existing.steps.length <= fact.steps.length) return false;
    facts.set(key(scope, name), fact);
    metrics.factsCreated += 1;
    return true;
  };
  const requestSource = (scope: string, expression: Node): FlowFact | undefined => {
    const chain = memberChain(expression);
    if (
      chain !== undefined &&
      ((chain.root === "location" && ["search", "hash"].includes(chain.properties[0] ?? "")) ||
        (["window", "document"].includes(chain.root) &&
          chain.properties[0] === "location" &&
          ["search", "hash"].includes(chain.properties[1] ?? "")))
    ) {
      const source: FlowStep = {
        kind: "SOURCE",
        label: `${chain.root}.${chain.properties.join(".")} is attacker-influenced browser URL input`,
        path: file.relativePath,
        offset: expression.start ?? 0,
      };
      return { source, steps: [], unknownControl: false };
    }
    const info = functions.get(scope);
    if (info?.routeRoot !== true) return undefined;
    const request = info.parameters[0];
    if (request === undefined || request === "") return undefined;
    if (chain === undefined || chain.root !== request) return undefined;
    const first = chain.properties[0];
    if (!["query", "body", "params", "headers", "cookies", "nextUrl"].includes(first ?? ""))
      return undefined;
    const source: FlowStep = {
      kind: "SOURCE",
      label: `${chain.root}.${chain.properties.join(".")} is untrusted request input`,
      path: file.relativePath,
      offset: expression.start ?? 0,
    };
    return { source, steps: [], unknownControl: false };
  };
  const recognizedHtmlControl = (
    expression: Extract<Node, { type: "CallExpression" | "OptionalCallExpression" }>,
  ): "HTML_ESCAPE" | "HTML_SANITIZE" | undefined => {
    const chain = memberChain(expression.callee);
    if (expression.callee.type === "Identifier") {
      if (shadowedImportNames.has(expression.callee.name)) return undefined;
      const binding = imports.get(expression.callee.name);
      if (
        binding !== undefined &&
        ((binding.module === "escape-html" && ["default", "*"].includes(binding.imported)) ||
          (binding.module === "he" && ["escape", "encode"].includes(binding.imported)))
      )
        return "HTML_ESCAPE";
      if (
        binding !== undefined &&
        binding.module === "sanitize-html" &&
        ["default", "*"].includes(binding.imported)
      )
        return "HTML_SANITIZE";
      return undefined;
    }
    if (chain === undefined || shadowedImportNames.has(chain.root)) return undefined;
    const binding = imports.get(chain.root);
    const method = chain.properties.at(-1);
    if (binding?.module === "he" && ["escape", "encode"].includes(method ?? ""))
      return "HTML_ESCAPE";
    if (
      ["dompurify", "isomorphic-dompurify", "sanitize-html"].includes(binding?.module ?? "") &&
      method === "sanitize"
    )
      return "HTML_SANITIZE";
    return undefined;
  };
  const evaluate = (scope: string, expression: Node | null | undefined): FlowFact | undefined => {
    if (expression === undefined || expression === null) return undefined;
    const direct = requestSource(scope, expression);
    if (direct !== undefined) return direct;
    if (expression.type === "Identifier") return facts.get(key(scope, expression.name));
    if (
      expression.type === "TSAsExpression" ||
      expression.type === "TSTypeAssertion" ||
      expression.type === "TSNonNullExpression" ||
      expression.type === "TypeCastExpression" ||
      expression.type === "ParenthesizedExpression"
    ) {
      return evaluate(scope, expression.expression);
    }
    if (expression.type === "AwaitExpression") return evaluate(scope, expression.argument);
    if (expression.type === "MemberExpression" || expression.type === "OptionalMemberExpression") {
      const compound = propertyKey(expression);
      const stored = compound === undefined ? undefined : facts.get(key(scope, compound));
      return stored ?? evaluate(scope, expression.object);
    }
    if (expression.type === "BinaryExpression" || expression.type === "LogicalExpression") {
      return deterministicFact([
        evaluate(scope, expression.left),
        evaluate(scope, expression.right),
      ]);
    }
    if (expression.type === "ConditionalExpression") {
      return deterministicFact([
        evaluate(scope, expression.consequent),
        evaluate(scope, expression.alternate),
      ]);
    }
    if (expression.type === "TemplateLiteral") {
      return deterministicFact(expression.expressions.map((item) => evaluate(scope, item)));
    }
    if (expression.type === "ArrayExpression") {
      return deterministicFact(expression.elements.map((item) => evaluate(scope, item)));
    }
    if (expression.type === "ObjectExpression") {
      return deterministicFact(
        expression.properties.map((property) =>
          property.type === "ObjectProperty" ? evaluate(scope, property.value) : undefined,
        ),
      );
    }
    if (expression.type === "NewExpression" && expression.callee.type === "Identifier") {
      const fact = deterministicFact(
        expression.arguments.map((argument) => evaluate(scope, argument)),
      );
      return fact === undefined
        ? undefined
        : appendStep(fact, {
            kind: "TRANSFORMATION",
            label: `new ${expression.callee.name}(...) preserves destination influence`,
            path: file.relativePath,
            offset: expression.start ?? 0,
          });
    }
    if (expression.type === "CallExpression" || expression.type === "OptionalCallExpression") {
      const chain = memberChain(expression.callee);
      const info =
        expression.callee.type === "Identifier"
          ? (() => {
              const ids = functionNames.get(expression.callee.name) ?? [];
              return ids.length === 1 ? functions.get(ids[0] ?? "") : undefined;
            })()
          : undefined;
      if (info !== undefined) return returns.get(info.id);
      if (
        chain !== undefined &&
        chain.root === functions.get(scope)?.parameters[0] &&
        chain.properties.includes("nextUrl") &&
        chain.properties.includes("searchParams") &&
        chain.properties.at(-1) === "get"
      ) {
        const source: FlowStep = {
          kind: "SOURCE",
          label: `${chain.root}.${chain.properties.join(".")} reads untrusted request input`,
          path: file.relativePath,
          offset: expression.start ?? 0,
        };
        return { source, steps: [], unknownControl: false };
      }
      const receiverFact =
        expression.callee.type === "MemberExpression" ||
        expression.callee.type === "OptionalMemberExpression"
          ? evaluate(scope, expression.callee.object)
          : undefined;
      const argumentFact = deterministicFact([
        receiverFact,
        ...expression.arguments.map((argument) => evaluate(scope, argument)),
      ]);
      if (argumentFact === undefined) return undefined;
      const calleeName =
        expression.callee.type === "Identifier"
          ? expression.callee.name
          : (chain?.properties.at(-1) ?? "call");
      const preserving = new Set([
        "String",
        "encodeURIComponent",
        "decodeURIComponent",
        "trim",
        "toString",
        "replace",
        "replaceAll",
        "join",
        "concat",
      ]);
      const htmlControl = recognizedHtmlControl(expression);
      if (htmlControl !== undefined) {
        return appendControl(argumentFact, htmlControl, {
          kind: "CONTROL",
          label: `${htmlControl} applied by a provenance-backed supported library`,
          path: file.relativePath,
          offset: expression.start ?? 0,
        });
      }
      return appendStep(
        argumentFact,
        {
          kind: "TRANSFORMATION",
          label: `${calleeName}(...) ${preserving.has(calleeName) ? "preserves untrusted influence" : "has unknown security semantics"}`,
          path: file.relativePath,
          offset: expression.start ?? 0,
        },
        argumentFact.unknownControl || !preserving.has(calleeName),
      );
    }
    return undefined;
  };

  const recordUnknown = (
    ruleId: string,
    sinkNode: Node,
    reasonCodes: RemediationReasonCode[],
    explanation: string,
  ): void => {
    const offset = sinkNode.start ?? 0;
    const unknownKey = `${ruleId}:${file.relativePath}:${offset}`;
    if (unknownKeys.has(unknownKey)) return;
    unknownKeys.add(unknownKey);
    unknowns.push({
      ruleId,
      path: file.relativePath,
      line: pointAt(file.text, offset).line,
      reasonCodes,
      explanation,
    });
  };

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    metrics.iterations = Math.max(metrics.iterations, iteration + 1);
    const iterationState = { changed: false };
    traverse(parsed.ast, {
      VariableDeclarator(path_) {
        const scope = scopeId(file, path_);
        const info = functions.get(scope);
        if (scope !== programId && info?.reachable !== true) return;
        const fact = evaluate(scope, path_.node.init);
        if (path_.node.id.type === "Identifier") {
          iterationState.changed =
            putFact(
              scope,
              path_.node.id.name,
              fact === undefined
                ? undefined
                : appendStep(fact, {
                    kind: "PROPAGATION",
                    label: `assigned to ${path_.node.id.name}`,
                    path: file.relativePath,
                    offset: path_.node.start ?? 0,
                  }),
            ) || iterationState.changed;
          if (path_.node.init?.type === "ObjectExpression") {
            for (const property of path_.node.init.properties) {
              if (property.type !== "ObjectProperty") continue;
              const propertyName = memberPropertyName(property.key);
              if (propertyName === undefined) continue;
              iterationState.changed =
                putFact(
                  scope,
                  `${path_.node.id.name}.${propertyName}`,
                  evaluate(scope, property.value),
                ) || iterationState.changed;
            }
          }
        } else if (path_.node.id.type === "ObjectPattern" && fact !== undefined) {
          for (const property of path_.node.id.properties) {
            if (property.type === "ObjectProperty" && property.value.type === "Identifier") {
              iterationState.changed =
                putFact(scope, property.value.name, fact) || iterationState.changed;
            }
          }
        }
      },
      AssignmentExpression(path_) {
        const scope = scopeId(file, path_);
        const info = functions.get(scope);
        if (scope !== programId && info?.reachable !== true) return;
        const name = propertyKey(path_.node.left);
        if (name !== undefined)
          iterationState.changed =
            putFact(scope, name, evaluate(scope, path_.node.right)) || iterationState.changed;
        const left = path_.node.left;
        const assignedFact = evaluate(scope, path_.node.right);
        if (
          !staticallyUnreachable(path_) &&
          (left.type === "MemberExpression" || left.type === "OptionalMemberExpression") &&
          memberPropertyName(left.property) === "innerHTML" &&
          domElementNames.has(rootIdentifier(left.object) ?? "") &&
          assignedFact !== undefined
        ) {
          if (assignedFact.unknownControl) {
            recordUnknown(
              "AS-XSS-001",
              path_.node,
              ["SANITIZER_UNKNOWN", "INSUFFICIENT_DATAFLOW_PROOF"],
              "Untrusted browser content reaches DOM innerHTML through an unknown transformation.",
            );
          } else {
            const evaluation = xssControlEvaluation(assignedFact, "RAW_HTML");
            if (evaluation !== "RECOGNIZED_EFFECTIVE") {
              const candidate = createCandidate(
                "XSS",
                file,
                path_.node,
                assignedFact,
                `DOM innerHTML assignment in ${info?.name ?? "top-level browser code"}`,
                "Proven attacker-influenced input reaches a structurally resolved DOM innerHTML sink.",
                "UNTRUSTED_BROWSER_CONTENT_MUST_NOT_REACH_RAW_RENDERING_WITHOUT_A_CONTEXT_APPROPRIATE_CONTROL",
                evaluation === "RECOGNIZED_INEFFECTIVE" ? "RECOGNIZED_INEFFECTIVE" : "ABSENT",
              );
              if (candidate !== undefined) candidates.set(candidate.fingerprintAnchor, candidate);
            }
          }
        }
      },
      JSXAttribute(path_) {
        if (path_.node.name.name !== "dangerouslySetInnerHTML") return;
        const opening = path_.parentPath.node;
        if (
          opening.name.type !== "JSXIdentifier" ||
          opening.name.name !== opening.name.name.toLowerCase()
        )
          return;
        const scope = scopeId(file, path_);
        const info = functions.get(scope);
        if (scope !== programId && info?.reachable !== true) return;
        const container = path_.node.value;
        if (container?.type !== "JSXExpressionContainer") return;
        const expression = container.expression;
        if (expression.type !== "ObjectExpression") return;
        const rawHtml = objectPropertyValue(expression, "__html");
        const fact = evaluate(scope, rawHtml);
        if (rawHtml === undefined || fact === undefined) return;
        if (fact.unknownControl) {
          recordUnknown(
            "AS-XSS-001",
            path_.node,
            ["SANITIZER_UNKNOWN", "INSUFFICIENT_DATAFLOW_PROOF"],
            "Untrusted content reaches React dangerouslySetInnerHTML through an unknown transformation.",
          );
          return;
        }
        const evaluation = xssControlEvaluation(fact, "RAW_HTML");
        if (evaluation === "RECOGNIZED_EFFECTIVE") return;
        const candidate = createCandidate(
          "XSS",
          file,
          path_.node,
          fact,
          `React ${opening.name.name}.dangerouslySetInnerHTML in ${info?.name ?? "route"}`,
          "Proven untrusted input reaches React's explicit raw HTML escape hatch without a supported HTML sanitizer.",
          "UNTRUSTED_BROWSER_CONTENT_MUST_NOT_REACH_RAW_RENDERING_WITHOUT_A_CONTEXT_APPROPRIATE_CONTROL",
          evaluation === "RECOGNIZED_INEFFECTIVE" ? "RECOGNIZED_INEFFECTIVE" : "ABSENT",
        );
        if (candidate !== undefined) candidates.set(candidate.fingerprintAnchor, candidate);
      },
      ReturnStatement(path_) {
        const scope = scopeId(file, path_);
        const info = functions.get(scope);
        if (info?.reachable !== true) return;
        const fact = evaluate(scope, path_.node.argument);
        const existing = returns.get(scope);
        if (
          fact !== undefined &&
          (existing === undefined || fact.steps.length < existing.steps.length)
        ) {
          returns.set(scope, fact);
          iterationState.changed = true;
        }
      },
      CallExpression(path_) {
        if (staticallyUnreachable(path_)) return;
        const scope = scopeId(file, path_);
        const info = functions.get(scope);
        if (scope !== programId && info?.reachable !== true) return;
        metrics.pathsConsidered += 1;
        const call = path_.node;
        if (call.callee.type === "Identifier") {
          const targets = functionNames.get(call.callee.name) ?? [];
          const callee = targets.length === 1 ? functions.get(targets[0] ?? "") : undefined;
          if (callee !== undefined) {
            const arguments_ = expressionArguments(call);
            for (let index = 0; index < callee.parameters.length; index += 1) {
              const parameter = callee.parameters[index];
              if (parameter === undefined || parameter === "") continue;
              const fact = evaluate(scope, arguments_[index]);
              iterationState.changed =
                putFact(
                  callee.id,
                  parameter,
                  fact === undefined
                    ? undefined
                    : appendStep(fact, {
                        kind: "PROPAGATION",
                        label: `passed as argument ${index + 1} to ${callee.name}(${parameter})`,
                        path: file.relativePath,
                        offset: call.start ?? 0,
                      }),
                ) || iterationState.changed;
            }
          }
        }
        const descriptor = callDescriptor(call, imports, objectOrigins, path_);
        const arguments_ = expressionArguments(call);
        const first = arguments_[0];
        const firstFact = evaluate(scope, first);
        const add = (candidate: DataflowCandidate | undefined): void => {
          if (candidate !== undefined) candidates.set(candidate.fingerprintAnchor, candidate);
        };

        const sqlMethod = descriptor.method;
        const sqlSink =
          descriptor.module !== undefined &&
          SQL_MODULES.has(descriptor.module) &&
          ["query", "execute", "exec", "raw", "$queryRawUnsafe", "$executeRawUnsafe"].includes(
            sqlMethod ?? "",
          );
        if (sqlSink && firstFact !== undefined) {
          if (firstFact.unknownControl) {
            recordUnknown(
              "AS-INJECTION-SQL-001",
              call,
              ["SANITIZER_UNKNOWN", "INSUFFICIENT_DATAFLOW_PROOF"],
              "Untrusted data reaches an unrecognized transformation before a SQL sink; Cydetix cannot prove whether it affects SQL structure.",
            );
          } else {
            add(
              createCandidate(
                "SQL_INJECTION",
                file,
                call,
                firstFact,
                `${descriptor.module}.${sqlMethod}`,
                "Proven untrusted request data controls SQL statement structure at a recognized database sink without separate parameterization.",
                "UNTRUSTED_SQL_DATA_MUST_NOT_CONTROL_SQL_STRUCTURE",
                "ABSENT",
              ),
            );
          }
        }

        const commandBinding =
          call.callee.type === "Identifier"
            ? importedBinding(imports, call.callee.name, COMMAND_MODULES, path_)
            : undefined;
        const commandMethod = commandBinding?.imported ?? descriptor.method;
        const commandModule = commandBinding?.module ?? descriptor.module;
        const shellString =
          commandModule !== undefined &&
          COMMAND_MODULES.has(commandModule) &&
          ["exec", "execSync"].includes(commandMethod ?? "");
        const spawnWithShell =
          commandModule !== undefined &&
          COMMAND_MODULES.has(commandModule) &&
          ["spawn", "spawnSync"].includes(commandMethod ?? "") &&
          isTrueProperty(
            arguments_.findLast(
              (argument): argument is ObjectExpression => argument.type === "ObjectExpression",
            ),
            "shell",
          );
        const commandFact = spawnWithShell
          ? deterministicFact(arguments_.slice(0, 2).map((argument) => evaluate(scope, argument)))
          : firstFact;
        if ((shellString || spawnWithShell) && commandFact !== undefined) {
          if (commandFact.unknownControl) {
            recordUnknown(
              "AS-INJECTION-CMD-001",
              call,
              ["SANITIZER_UNKNOWN", "INSUFFICIENT_DATAFLOW_PROOF"],
              "Untrusted data reaches an unknown transformation before shell execution; control sufficiency is UNKNOWN.",
            );
          } else {
            add(
              createCandidate(
                "COMMAND_INJECTION",
                file,
                call,
                commandFact,
                `${commandModule}.${commandMethod}`,
                "Proven untrusted request data controls a shell command string or shell-enabled process invocation.",
                "UNTRUSTED_INPUT_MUST_NOT_CONTROL_SHELL_SYNTAX",
                "ABSENT",
              ),
            );
          }
        }

        const filesystemBinding =
          call.callee.type === "Identifier"
            ? importedBinding(imports, call.callee.name, FILESYSTEM_MODULES, path_)
            : undefined;
        const filesystemMethod = filesystemBinding?.imported ?? descriptor.method;
        const filesystemModule = filesystemBinding?.module ?? descriptor.module;
        const responseParameter = routeResponseParameters.get(scope);
        const responseSink =
          descriptor.receiver === responseParameter &&
          ["sendFile", "download"].includes(filesystemMethod ?? "");
        const filesystemSink =
          (filesystemModule !== undefined &&
            FILESYSTEM_MODULES.has(filesystemModule) &&
            [
              "readFile",
              "readFileSync",
              "writeFile",
              "writeFileSync",
              "appendFile",
              "unlink",
              "rm",
              "rmdir",
              "rename",
              "stat",
              "lstat",
              "access",
              "open",
              "createReadStream",
              "createWriteStream",
              "readdir",
              "mkdir",
            ].includes(filesystemMethod ?? "")) ||
          responseSink;
        if (filesystemSink && first !== undefined && firstFact !== undefined) {
          if (pathConfined(file.text, first, call.start ?? 0)) {
            // A recognized canonical confinement check proves this supported path safe.
          } else if (firstFact.unknownControl) {
            recordUnknown(
              "AS-PATH-001",
              call,
              ["SANITIZER_UNKNOWN", "INSUFFICIENT_DATAFLOW_PROOF"],
              "An unknown path transformation precedes a filesystem sink; canonical confinement cannot be proven.",
            );
          } else {
            add(
              createCandidate(
                "PATH_TRAVERSAL",
                file,
                call,
                firstFact,
                responseSink
                  ? `Express response.${filesystemMethod}`
                  : `${filesystemModule}.${filesystemMethod}`,
                "Proven untrusted request data reaches a filesystem path sink without a recognized canonical authorized-root confinement check.",
                "UNTRUSTED_PATHS_MUST_REMAIN_WITHIN_AUTHORIZED_FILESYSTEM_ROOT",
                "ABSENT",
              ),
            );
          }
        }

        const httpBinding =
          call.callee.type === "Identifier"
            ? importedBinding(imports, call.callee.name, HTTP_MODULES, path_)
            : undefined;
        const httpModule = httpBinding?.module ?? descriptor.module;
        const httpMethod = httpBinding?.imported ?? descriptor.method;
        const globalFetch =
          call.callee.type === "Identifier" &&
          call.callee.name === "fetch" &&
          path_.scope.getBinding("fetch") === undefined &&
          scope !== programId;
        const httpSink =
          globalFetch ||
          (httpModule !== undefined &&
            HTTP_MODULES.has(httpModule) &&
            ["default", "fetch", "request", "get", "post", "put", "patch", "delete"].includes(
              httpMethod ?? "",
            ));
        let destination = first;
        if (
          httpSink &&
          first?.type === "ObjectExpression" &&
          objectPropertyValue(first, "url") !== undefined
        ) {
          destination = objectPropertyValue(first, "url");
        }
        const destinationFact = evaluate(scope, destination);
        if (httpSink && destination !== undefined && destinationFact !== undefined) {
          if (urlPolicyEnforced(file.text, destination, call.start ?? 0)) {
            // Exact hostname allowlist plus scheme restriction is a recognized control.
          } else if (destinationFact.unknownControl) {
            recordUnknown(
              "AS-SSRF-001",
              call,
              ["SANITIZER_UNKNOWN", "INSUFFICIENT_DATAFLOW_PROOF"],
              "An unknown URL transformation precedes an HTTP sink; destination policy enforcement is UNKNOWN.",
            );
          } else {
            add(
              createCandidate(
                "SSRF",
                file,
                call,
                destinationFact,
                globalFetch ? "global fetch" : `${httpModule}.${httpMethod}`,
                "Proven untrusted request data controls the destination of a recognized server-side HTTP request without an enforced destination policy.",
                "UNTRUSTED_NETWORK_DESTINATION_MUST_NOT_CONTROL_SERVER_SIDE_REQUEST_TARGET_WITHOUT_ENFORCED_POLICY",
                "ABSENT",
              ),
            );
          }
        }

        const routeFramework = routeFrameworks.get(scope);
        const explicitFastifyHtml =
          responseParameter !== undefined &&
          new RegExp(
            `${responseParameter.replaceAll(/[$]/g, "\\$")}\\.(?:type|header)\\s*\\([^)]*["'](?:content-type["']\\s*,\\s*)?text/html`,
            "i",
          ).test(file.text.slice(functions.get(scope)?.node.start ?? 0, call.start ?? 0));
        const htmlResponseSink =
          descriptor.receiver === responseParameter &&
          ["send", "write", "end"].includes(descriptor.method ?? "") &&
          (routeFramework === "express" || (routeFramework === "fastify" && explicitFastifyHtml));
        if (htmlResponseSink && first !== undefined && firstFact !== undefined) {
          const context = xssTemplateContext(first);
          const evaluation = xssControlEvaluation(firstFact, context);
          if (firstFact.unknownControl) {
            recordUnknown(
              "AS-XSS-001",
              call,
              ["SANITIZER_UNKNOWN", "INSUFFICIENT_DATAFLOW_PROOF"],
              "Untrusted content reaches an HTML response through a transformation whose context-specific safety is UNKNOWN.",
            );
          } else if (evaluation !== "RECOGNIZED_EFFECTIVE") {
            add(
              createCandidate(
                "XSS",
                file,
                call,
                firstFact,
                `${routeFramework} ${responseParameter}.${descriptor.method} (${context}) in ${info?.name ?? "route"}`,
                `Proven untrusted input reaches a supported ${context} browser rendering sink without a context-appropriate control.`,
                "UNTRUSTED_BROWSER_CONTENT_MUST_NOT_REACH_RAW_RENDERING_WITHOUT_A_CONTEXT_APPROPRIATE_CONTROL",
                evaluation === "RECOGNIZED_INEFFECTIVE" ? "RECOGNIZED_INEFFECTIVE" : "ABSENT",
              ),
            );
          }
        }

        const redirectBinding =
          call.callee.type === "Identifier"
            ? importedBinding(imports, call.callee.name, REDIRECT_MODULES, path_)
            : undefined;
        const responseRedirect =
          descriptor.receiver === responseParameter && descriptor.method === "redirect";
        const nextRedirect =
          (redirectBinding !== undefined && redirectBinding.imported === "redirect") ||
          (descriptor.module === "next/server" &&
            descriptor.receiver !== undefined &&
            descriptor.method === "redirect");
        const redirectSink = responseRedirect || nextRedirect;
        const redirectArgument =
          responseRedirect && first?.type === "NumericLiteral" ? arguments_[1] : first;
        const redirectFact = evaluate(scope, redirectArgument);
        if (redirectSink && redirectArgument !== undefined && redirectFact !== undefined) {
          if (redirectPolicyEnforced(file.text, redirectArgument, call.start ?? 0)) {
            // Canonical exact-host or exact-origin validation proves the supported destination policy.
          } else if (redirectFact.unknownControl) {
            recordUnknown(
              "AS-REDIRECT-001",
              call,
              ["SANITIZER_UNKNOWN", "INSUFFICIENT_DATAFLOW_PROOF"],
              "An unknown destination transformation precedes a redirect sink; redirect policy sufficiency is UNKNOWN.",
            );
          } else {
            const weakPrefix = naiveRedirectPrefixCheck(
              file.text,
              redirectArgument,
              call.start ?? 0,
            );
            const proofFact = weakPrefix
              ? appendStep(redirectFact, {
                  kind: "CONTROL",
                  label:
                    "SAME_ORIGIN_REDIRECT_POLICY textual startsWith('/') check is contextually ineffective",
                  path: file.relativePath,
                  offset: call.start ?? 0,
                })
              : redirectFact;
            add(
              createCandidate(
                "OPEN_REDIRECT",
                file,
                call,
                proofFact,
                `${responseRedirect ? routeFramework : "Next.js"} redirect in ${info?.name ?? "route"}`,
                "Proven attacker-influenced input determines a supported redirect destination without an explicit approved destination policy.",
                "UNTRUSTED_REDIRECT_DESTINATIONS_MUST_BE_CONFINED_TO_AN_EXPLICIT_APPROVED_POLICY",
                weakPrefix ? "RECOGNIZED_INEFFECTIVE" : "ABSENT",
              ),
            );
          }
        }
      },
    });
    if (!iterationState.changed) break;
    if (facts.size >= MAX_FACTS) {
      metrics.truncationEvents += 1;
      return { candidates: [], truncated: true };
    }
  }
  return {
    candidates: [...candidates.values()].sort(
      (left, right) => left.startOffset - right.startOffset,
    ),
    truncated: false,
  };
}

function pythonImports(source: string): Set<string> {
  const modules = new Set<string>();
  for (const match of source.matchAll(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm)) {
    const module = match[1] ?? match[2];
    if (module !== undefined) modules.add(module.split(".")[0] ?? module);
  }
  return modules;
}

interface PythonFact {
  readonly sourceOffset: number;
  readonly sourceLabel: string;
  readonly steps: readonly {
    kind?: "PROPAGATION" | "CONTROL";
    label: string;
    offset: number;
  }[];
  readonly unknownControl: boolean;
  readonly controls?: readonly ("HTML_ESCAPE" | "HTML_SANITIZE")[];
}

function pythonXssContext(text: string): XssContext {
  const lower = text.toLowerCase();
  const marker = lower.search(/(?:\{|%s|\.format\s*\()/u);
  const prefix = marker < 0 ? lower : lower.slice(0, marker);
  if (prefix.lastIndexOf("<script") > prefix.lastIndexOf("</script")) return "JAVASCRIPT";
  if (/(?:href|src|action|formaction)\s*=\s*["'][^"']*$/u.test(prefix)) return "URL";
  if (/[a-z_:][-a-z0-9_:.]*\s*=\s*["'][^"']*$/u.test(prefix)) return "HTML_ATTRIBUTE";
  return "HTML_BODY";
}

function pythonRedirectPolicyEnforced(
  source: string,
  destination: string,
  sinkOffset: number,
): boolean {
  const identifier = /^\s*(?:url\s*=\s*)?([A-Za-z_]\w*)(?:\.(?:geturl|url)(?:\(\))?)?\s*$/u.exec(
    destination,
  )?.[1];
  if (identifier === undefined) return false;
  const escaped = identifier.replaceAll(/[$]/g, "\\$");
  const before = source.slice(0, sinkOffset);
  const parsed = new RegExp(`(?:${escaped}\\s*=\\s*)?(?:urlparse|urlsplit)\\s*\\(`).test(before);
  const exactHostGuard = new RegExp(
    `if\\s+${escaped}\\.(?:hostname|netloc)\\s+not\\s+in\\s+(?:ALLOWED_REDIRECT_HOSTS|allowed_redirect_hosts)[^\\n]*:[^\\n]*(?:return|raise)`,
  ).test(before);
  const exactOriginGuard = new RegExp(
    `if\\s+${escaped}\\.(?:hostname|netloc)\\s*!=\\s*(?:["'][^"']+["']|APP_HOST|app_host)[^\\n]*:[^\\n]*(?:return|raise)`,
  ).test(before);
  const schemeGuard = new RegExp(
    `if\\s+${escaped}\\.scheme\\s*(?:!=|not\\s+in)\\s*(?:["']https?["']|\\([^)]*["']https?["'])[^\\n]*:[^\\n]*(?:return|raise)`,
  ).test(before);
  return parsed && ((exactHostGuard && schemeGuard) || (exactOriginGuard && schemeGuard));
}

function analyzePythonFile(
  file: SourceFile,
  parsed: Extract<ParsedSource, { language: "python" }>,
  metrics: MutableMetrics,
  unknowns: ApplicationDataflowAnalysis["unknowns"],
): { candidates: DataflowCandidate[]; truncated: boolean } {
  const cursor = parsed.ast.cursor();
  const executableRanges: Array<{ name: string; from: number; to: number }> = [];
  let nodes = 0;
  do {
    nodes += 1;
    if (["AssignStatement", "CallExpression", "FunctionDefinition"].includes(cursor.name)) {
      executableRanges.push({ name: cursor.name, from: cursor.from, to: cursor.to });
    }
  } while (cursor.next());
  metrics.astNodesVisited += nodes;
  if (nodes > MAX_AST_NODES_PER_FILE || metrics.astNodesVisited > MAX_REPOSITORY_AST_NODES) {
    metrics.truncationEvents += 1;
    return { candidates: [], truncated: true };
  }
  metrics.filesAnalyzed += 1;
  const imports = pythonImports(file.text);
  const routeFunctions: Array<{
    from: number;
    to: number;
    parameters: string[];
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "UNKNOWN";
    decorator: string;
  }> = [];
  for (const range of executableRanges.filter((item) => item.name === "FunctionDefinition")) {
    const header = file.text.slice(
      range.from,
      Math.min(range.to, file.text.indexOf("\n", range.from)),
    );
    const parameters =
      /def\s+\w+\s*\(([^)]*)\)/
        .exec(header)?.[1]
        ?.split(",")
        .map((item) => item.trim().split(/[=:]/)[0]?.trim() ?? "")
        .filter((item) => /^[A-Za-z_]\w*$/.test(item)) ?? [];
    const prefix = file.text.slice(Math.max(0, range.from - 240), range.from);
    const decorator =
      /@(?:app|router)\.(get|post|put|patch|delete|route)\s*\([^\n]*\)\s*(?:@[^\n]+\s*)*$/u.exec(
        prefix,
      );
    if (decorator !== null) {
      const named = decorator[1]?.toUpperCase();
      const routeText = decorator[0];
      const configured = /methods\s*=\s*\[[^\]]*["'](GET|POST|PUT|PATCH|DELETE)["']/iu
        .exec(routeText)?.[1]
        ?.toUpperCase();
      const method =
        named === "ROUTE"
          ? ((configured as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | undefined) ?? "UNKNOWN")
          : ((named as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | undefined) ?? "UNKNOWN");
      routeFunctions.push({
        from: range.from,
        to: range.to,
        parameters,
        method,
        decorator: routeText,
      });
    }
  }
  const containingRoute = (offset: number) =>
    routeFunctions.find((route) => offset >= route.from && offset <= route.to);
  const facts = new Map<string, PythonFact>();
  const candidates: DataflowCandidate[] = [];
  const applyPythonHtmlControl = (text: string, offset: number, fact: PythonFact): PythonFact => {
    const htmlEscape =
      ((imports.has("markupsafe") || imports.has("flask")) && /\bescape\s*\(/u.test(text)) ||
      (imports.has("html") && /\bhtml\.escape\s*\(/u.test(text));
    const htmlSanitize = imports.has("bleach") && /\bbleach\.clean\s*\(/u.test(text);
    if (!htmlEscape && !htmlSanitize) return fact;
    const control: "HTML_ESCAPE" | "HTML_SANITIZE" = htmlSanitize ? "HTML_SANITIZE" : "HTML_ESCAPE";
    return {
      ...fact,
      steps: [
        ...fact.steps,
        {
          kind: "CONTROL" as const,
          label: `${control} applied by a provenance-backed supported Python library`,
          offset,
        },
      ].slice(0, MAX_EVIDENCE_STEPS),
      controls: [...new Set([...(fact.controls ?? []), control])],
    };
  };
  const applyPythonUnknownTransformation = (text: string, fact: PythonFact): PythonFact => {
    const recognizedHtmlCall =
      /\bescape\s*\(/u.test(text) || /\b(?:html\.escape|bleach\.clean)\s*\(/u.test(text);
    const unknownCall =
      !recognizedHtmlCall && /(?<!\.)\b(?!str\b|quote\b|urlencode\b)[A-Za-z_]\w*\s*\(/u.test(text);
    return unknownCall ? { ...fact, unknownControl: true } : fact;
  };
  const expressionFact = (
    text: string,
    offset: number,
    route: ReturnType<typeof containingRoute>,
  ) => {
    if (isPythonStaticStringLiteral(text)) return undefined;
    const flaskSource = /\brequest\.(?:args|form|json|values|headers|cookies)(?:\b|\[)/.exec(text);
    if (flaskSource !== null && imports.has("flask")) {
      return applyPythonUnknownTransformation(
        text,
        applyPythonHtmlControl(text, offset, {
          sourceOffset: offset + flaskSource.index,
          sourceLabel: `${flaskSource[0]} is untrusted Flask request input`,
          steps: [],
          unknownControl: false,
        } satisfies PythonFact),
      );
    }
    if (route !== undefined) {
      for (const parameter of route.parameters) {
        if (parameter !== "self" && new RegExp(`\\b${parameter}\\b`).test(text)) {
          return applyPythonUnknownTransformation(
            text,
            applyPythonHtmlControl(
              text,
              offset,
              facts.get(`${route.from}:${parameter}`) ?? {
                sourceOffset: route.from,
                sourceLabel: `${parameter} is request-bound FastAPI input`,
                steps: [],
                unknownControl: false,
              },
            ),
          );
        }
      }
    }
    const used = [...facts.entries()]
      .filter(
        ([qualifiedName]) =>
          route !== undefined &&
          qualifiedName.startsWith(`${route.from}:`) &&
          new RegExp(`\\b${qualifiedName.slice(qualifiedName.indexOf(":") + 1)}\\b`).test(text),
      )
      .map(([, fact]) => fact)
      .sort((left, right) => left.steps.length - right.steps.length)[0];
    if (used === undefined) return undefined;
    const recognizedHtmlCall =
      /\bescape\s*\(/u.test(text) || /\b(?:html\.escape|bleach\.clean)\s*\(/u.test(text);
    const customCall =
      !recognizedHtmlCall && /\b(?!str\b|quote\b|urlencode\b)[A-Za-z_]\w*\s*\(/u.test(text);
    return applyPythonHtmlControl(text, offset, {
      ...used,
      steps: [
        ...used.steps,
        {
          kind: "PROPAGATION" as const,
          label: `propagates through ${text.trim().slice(0, 80)}`,
          offset,
        },
      ].slice(0, MAX_EVIDENCE_STEPS),
      unknownControl: used.unknownControl || customCall,
    } satisfies PythonFact);
  };

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    metrics.iterations = Math.max(metrics.iterations, iteration + 1);
    let changed = false;
    for (const range of executableRanges.filter((item) => item.name === "AssignStatement")) {
      const route = containingRoute(range.from);
      if (route === undefined) continue;
      const statement = file.text.slice(range.from, range.to);
      const assignment = /^\s*([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/.exec(statement);
      if (assignment === null) continue;
      const fact = expressionFact(assignment[2] ?? "", range.from, route);
      const name = assignment[1];
      const factKey = name === undefined ? undefined : `${route.from}:${name}`;
      if (factKey !== undefined && fact !== undefined && !facts.has(factKey)) {
        facts.set(factKey, {
          ...fact,
          steps: [...fact.steps, { label: `assigned to ${name}`, offset: range.from }],
        });
        metrics.factsCreated += 1;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const addPythonCandidate = (
    kind: ApplicationDataflowKind,
    range: { from: number; to: number },
    fact: PythonFact,
    sink: string,
    message: string,
    invariant: string,
    controlEvaluation: "ABSENT" | "RECOGNIZED_INEFFECTIVE" = "ABSENT",
  ): void => {
    const sourcePoint = pointAt(file.text, fact.sourceOffset);
    const sinkPoint = pointAt(file.text, range.from);
    candidates.push({
      kind,
      file,
      startOffset: range.from,
      endOffset: range.to,
      message,
      affectedComponent: sink,
      proof: {
        schemaVersion: "1.0.0",
        source: {
          kind: "SOURCE",
          label: fact.sourceLabel,
          location: { path: file.relativePath, line: sourcePoint.line, column: sourcePoint.column },
        },
        propagationPath: fact.steps.map((step) => {
          const point = pointAt(file.text, step.offset);
          return {
            kind: step.kind ?? ("PROPAGATION" as const),
            label: step.label,
            location: { path: file.relativePath, line: point.line, column: point.column },
          };
        }),
        sink: {
          kind: "SINK",
          label: sink,
          location: { path: file.relativePath, line: sinkPoint.line, column: sinkPoint.column },
        },
        securityControlEncountered:
          controlEvaluation !== "ABSENT" || (fact.controls?.length ?? 0) > 0,
        securityControlEvaluation: controlEvaluation,
        reachability: "likely",
        invariant,
        conclusion: `${invariant} is violated by a complete, reachable source-to-sink path.`,
        proofState: "PROVEN_INSECURE",
        analysisLimitations: [
          "Python proof is bounded to a parsed decorated route, local assignments, import-qualified sinks, and documented controls.",
        ],
      },
      remediationReasons: ["AMBIGUOUS_SEMANTICS", "VERIFICATION_INSUFFICIENT"],
      fingerprintAnchor: `${kind}:${file.relativePath}:${range.from}:${fact.sourceOffset}`,
    });
  };
  for (const range of executableRanges.filter((item) => item.name === "CallExpression")) {
    const route = containingRoute(range.from);
    if (route === undefined) continue;
    metrics.pathsConsidered += 1;
    const callText = file.text.slice(range.from, range.to);
    const database =
      /\.(?:execute|executemany|executescript)\s*\(/.test(callText) &&
      [...imports].some((module) => ["sqlite3", "psycopg", "sqlalchemy"].includes(module));
    const osSystem = imports.has("os") && /\bos\.system\s*\(/.test(callText);
    const subprocessApi =
      imports.has("subprocess") &&
      /\bsubprocess\.(?:run|call|Popen|check_output|check_call)\s*\(/.test(callText);
    const commandApi = osSystem || subprocessApi;
    const filesystem =
      /\bopen\s*\(/.test(callText) ||
      (/\b(?:os|pathlib)\./.test(callText) &&
        /(?:remove|unlink|rename|stat|open|read_text|write_text)\s*\(/.test(callText));
    const http =
      [...imports].some((module) => ["requests", "httpx", "urllib"].includes(module)) &&
      /\.(?:get|post|put|patch|delete|request|urlopen)\s*\(/.test(callText);
    const pythonXss =
      ((imports.has("flask") || imports.has("markupsafe")) &&
        /\b(?:Markup|Response|make_response|render_template_string)\s*\(/u.test(callText)) ||
      (imports.has("markupsafe") && /\bmarkupsafe\.Markup\s*\(/u.test(callText)) ||
      ((imports.has("starlette") || imports.has("fastapi")) &&
        /\bHTMLResponse\s*\(/u.test(callText));
    const pythonRedirect =
      (imports.has("flask") && /\b(?:flask\.)?redirect\s*\(/u.test(callText)) ||
      ((imports.has("starlette") || imports.has("fastapi")) &&
        /\bRedirectResponse\s*\(/u.test(callText));
    const argumentText =
      (database
        ? extractPythonCallArguments(callText, /\.(?:execute|executemany|executescript)\s*\(/)
        : commandApi
          ? extractPythonCallArguments(
              callText,
              /\b(?:os\.system|subprocess\.(?:run|call|Popen|check_output|check_call))\s*\(/,
            )
          : filesystem
            ? extractPythonCallArguments(
                callText,
                /(?:\bopen|\b(?:os|pathlib)\.(?:remove|unlink|rename|stat|open|read_text|write_text))\s*\(/,
              )
            : http
              ? extractPythonCallArguments(
                  callText,
                  /\.(?:get|post|put|patch|delete|request|urlopen)\s*\(/,
                )
              : pythonXss
                ? extractPythonCallArguments(
                    callText,
                    /\b(?:Markup|Response|HTMLResponse|make_response|render_template_string|markupsafe\.Markup)\s*\(/,
                  )
                : pythonRedirect
                  ? extractPythonCallArguments(
                      callText,
                      /\b(?:flask\.)?(?:redirect|RedirectResponse)\s*\(/,
                    )
                  : undefined) ?? "";
    const command = osSystem || (subprocessApi && /\bshell\s*=\s*True\b/.test(argumentText));
    if (!database && !command && !filesystem && !http && !pythonXss && !pythonRedirect) continue;
    const firstArgument = (splitPythonTopLevelArguments(argumentText)[0] ?? "").replace(
      /^\s*(?:url|response)\s*=\s*/u,
      "",
    );
    const fact = expressionFact(firstArgument, range.from + callText.indexOf(firstArgument), route);
    if (fact === undefined) continue;
    const firstIdentifier = /^\s*([A-Za-z_]\w*)\s*$/.exec(firstArgument)?.[1];
    const routeBodyStart = file.text.indexOf("\n", route.from);
    const unknownControlBeforeSink =
      firstIdentifier !== undefined &&
      pythonUnknownControlBeforeSink(
        file.text.slice(routeBodyStart < 0 ? route.from : routeBodyStart + 1, range.from),
        firstIdentifier,
      );
    const unknown = (ruleId: string, explanation: string): void => {
      unknowns.push({
        ruleId,
        path: file.relativePath,
        line: pointAt(file.text, range.from).line,
        reasonCodes: ["SANITIZER_UNKNOWN", "INSUFFICIENT_DATAFLOW_PROOF"],
        explanation,
      });
    };
    if (database) {
      if (fact.unknownControl || unknownControlBeforeSink)
        unknown("AS-INJECTION-SQL-001", "SQL control semantics are UNKNOWN.");
      else
        addPythonCandidate(
          "SQL_INJECTION",
          range,
          fact,
          "Python database execute API",
          "Proven untrusted request data controls SQL structure at an imported database API.",
          "UNTRUSTED_SQL_DATA_MUST_NOT_CONTROL_SQL_STRUCTURE",
        );
    }
    if (command) {
      if (fact.unknownControl || unknownControlBeforeSink)
        unknown("AS-INJECTION-CMD-001", "Shell control semantics are UNKNOWN.");
      else
        addPythonCandidate(
          "COMMAND_INJECTION",
          range,
          fact,
          "Python shell execution API",
          "Proven untrusted request data controls shell syntax.",
          "UNTRUSTED_INPUT_MUST_NOT_CONTROL_SHELL_SYNTAX",
        );
    }
    if (filesystem) {
      const before = file.text.slice(route.from, range.from);
      const name = /^\s*([A-Za-z_]\w*)\s*$/.exec(firstArgument)?.[1];
      const confined =
        name !== undefined &&
        new RegExp(`\\b${name}\\s*=.*\\.resolve\\s*\\(`, "s").test(before) &&
        new RegExp(`\\b${name}\\.relative_to\\s*\\(`).test(before);
      if (!confined) {
        if (fact.unknownControl || unknownControlBeforeSink)
          unknown("AS-PATH-001", "Path confinement is UNKNOWN.");
        else
          addPythonCandidate(
            "PATH_TRAVERSAL",
            range,
            fact,
            "Python filesystem API",
            "Proven untrusted request data reaches a filesystem sink without canonical confinement.",
            "UNTRUSTED_PATHS_MUST_REMAIN_WITHIN_AUTHORIZED_FILESYSTEM_ROOT",
          );
      }
    }
    if (http) {
      const before = file.text.slice(route.from, range.from);
      const name = /^\s*([A-Za-z_]\w*)\s*$/.exec(firstArgument)?.[1];
      const policy =
        name !== undefined &&
        new RegExp(`urlparse\\s*\\([^)]*${name}[^)]*\\)`).test(before) &&
        /(?:ALLOWED_HOSTS|allowed_hosts)/.test(before) &&
        /\.scheme\s*(?:==|!=)\s*["']https["']/.test(before);
      if (!policy) {
        if (fact.unknownControl || unknownControlBeforeSink)
          unknown("AS-SSRF-001", "Network destination policy is UNKNOWN.");
        else
          addPythonCandidate(
            "SSRF",
            range,
            fact,
            "Python server-side HTTP client",
            "Proven untrusted request data controls a server-side request destination.",
            "UNTRUSTED_NETWORK_DESTINATION_MUST_NOT_CONTROL_SERVER_SIDE_REQUEST_TARGET_WITHOUT_ENFORCED_POLICY",
          );
      }
    }
    if (pythonXss) {
      const context = pythonXssContext(firstArgument);
      const controls = fact.controls ?? [];
      const effective = controls.some(
        (control) =>
          (control === "HTML_ESCAPE" &&
            ["HTML_BODY", "HTML_ATTRIBUTE", "RAW_HTML"].includes(context)) ||
          (control === "HTML_SANITIZE" && ["HTML_BODY", "RAW_HTML"].includes(context)),
      );
      if (!effective) {
        if (fact.unknownControl)
          unknown(
            "AS-XSS-001",
            "Python raw HTML rendering is reached through a transformation with UNKNOWN context-specific safety.",
          );
        else
          addPythonCandidate(
            "XSS",
            range,
            fact,
            `Python raw HTML rendering (${context})`,
            `Proven untrusted input reaches a supported ${context} Python HTML rendering sink without a context-appropriate control.`,
            "UNTRUSTED_BROWSER_CONTENT_MUST_NOT_REACH_RAW_RENDERING_WITHOUT_A_CONTEXT_APPROPRIATE_CONTROL",
            controls.length > 0 ? "RECOGNIZED_INEFFECTIVE" : "ABSENT",
          );
      }
    }
    if (pythonRedirect) {
      if (pythonRedirectPolicyEnforced(file.text, firstArgument, range.from)) {
        // Canonical exact host/origin validation proves the supported destination policy.
      } else if (fact.unknownControl || unknownControlBeforeSink) {
        unknown("AS-REDIRECT-001", "Python redirect destination policy semantics are UNKNOWN.");
      } else {
        const identifier = /^\s*([A-Za-z_]\w*)\s*$/u.exec(firstArgument)?.[1];
        const weakPrefix =
          identifier !== undefined &&
          new RegExp(`${identifier}\\.startswith\\s*\\(\\s*["']/["']\\s*\\)`).test(
            file.text.slice(route.from, range.from),
          );
        const proofFact: PythonFact = weakPrefix
          ? {
              ...fact,
              steps: [
                ...fact.steps,
                {
                  kind: "CONTROL" as const,
                  label:
                    "SAME_ORIGIN_REDIRECT_POLICY textual startswith('/') check is contextually ineffective",
                  offset: range.from,
                },
              ].slice(0, MAX_EVIDENCE_STEPS),
            }
          : fact;
        addPythonCandidate(
          "OPEN_REDIRECT",
          range,
          proofFact,
          "Python framework redirect response",
          "Proven attacker-influenced input determines a Python redirect destination without an approved destination policy.",
          "UNTRUSTED_REDIRECT_DESTINATIONS_MUST_BE_CONFINED_TO_AN_EXPLICIT_APPROVED_POLICY",
          weakPrefix ? "RECOGNIZED_INEFFECTIVE" : "ABSENT",
        );
      }
    }
  }
  const flaskCsrfGlobal =
    imports.has("flask_wtf") && /\bCSRFProtect\s*\(\s*(?:app|application)\s*\)/u.test(file.text);
  const pythonSameSite = /\bSESSION_COOKIE_SAMESITE\s*=\s*["'](?:Strict|Lax)["']/iu.test(file.text);
  for (const route of routeFunctions) {
    if (!STATE_CHANGING_METHODS.has(route.method)) continue;
    metrics.pathsConsidered += 1;
    const preamble = file.text.slice(Math.max(0, route.from - 400), route.from);
    const body = file.text.slice(route.from, route.to);
    const mutatesState =
      /\bsession\s*\[[^\]]+\]\s*=(?!=)|\bsession\.(?:pop|clear)\s*\(/u.test(body) ||
      /\bcurrent_user\.[A-Za-z_]\w*\s*=(?!=)/u.test(body) ||
      (imports.has("flask_sqlalchemy") &&
        /\b(?:db\.session\.(?:add|delete|commit)|query\.(?:update|delete))\s*\(/u.test(body)) ||
      (imports.has("os") && /\bos\.(?:remove|unlink|rename|replace)\s*\(/u.test(body));
    if (!mutatesState) continue;
    const flaskLogin =
      imports.has("flask_login") && /@login_required(?:\(\))?\s*$/mu.test(preamble);
    const flaskSession =
      imports.has("flask") &&
      /\bsession\s*(?:\[\s*["'](?:user|user_id|account|account_id|identity)["']\s*\]|\.get\s*\(\s*["'](?:user|user_id|account|account_id|identity)["'])/iu.test(
        body,
      );
    const bearerOnly =
      /\b(?:HTTPBearer|OAuth2PasswordBearer|Authorization)\b/u.test(`${preamble}\n${body}`) &&
      /\b(?:jwt\.decode|jwt\.verify|decode_token|verify_token)\s*\(/u.test(body) &&
      !flaskSession;
    if (bearerOnly) continue;
    const csrfControl =
      flaskCsrfGlobal ||
      (imports.has("flask_wtf") && /\bvalidate_csrf\s*\(/u.test(body)) ||
      (/\b(?:request\.)?headers(?:\.get|\[)\s*\(?\s*["']Origin["']/iu.test(body) &&
        /(?:==|!=)\s*(?:["']https?:\/\/[^"']+["']|APP_ORIGIN|app_origin)|(?:ALLOWED_ORIGINS|allowed_origins)/u.test(
          body,
        ));
    if (csrfControl) continue;
    const ambient = flaskLogin || flaskSession;
    if (!ambient || pythonSameSite) {
      unknowns.push({
        ruleId: "AS-CSRF-001",
        path: file.relativePath,
        line: pointAt(file.text, route.from).line,
        reasonCodes: ["INSUFFICIENT_DATAFLOW_PROOF"],
        explanation: pythonSameSite
          ? "SameSite cookie evidence exists, but route and browser request semantics are insufficient for universal CSRF proof."
          : "Authentication or ambient browser credential reliance is not proven for this state-changing Python route.",
      });
      continue;
    }
    addPythonCandidate(
      "CSRF",
      { from: route.from, to: route.to },
      {
        sourceOffset: route.from,
        sourceLabel: flaskLogin
          ? "Flask-Login supplies cookie-backed ambient authentication"
          : "Flask session identity supplies an ambient browser credential",
        steps: [
          {
            kind: "PROPAGATION",
            label: `${route.method} decorated route is browser reachable within the supported Flask model`,
            offset: route.from,
          },
        ],
        unknownControl: false,
      },
      `state-changing Python ${route.method} route`,
      `Proven ${route.method} Python route relies on ambient browser credentials without a supported anti-CSRF control.`,
      "AMBIENTLY_AUTHENTICATED_STATE_CHANGING_BROWSER_REQUESTS_MUST_PROVE_REQUEST_ORIGIN",
    );
  }
  return { candidates, truncated: false };
}

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_PACKAGES = new Set(["csurf", "csrf-csrf"]);

function analyzeExpressCsrf(
  files: readonly SourceFile[],
  parsedByPath: ReadonlyMap<string, ParsedSource>,
  securityIr: SecurityIr,
  metrics: MutableMetrics,
  unknowns: ApplicationDataflowAnalysis["unknowns"],
): DataflowCandidate[] {
  interface AmbientEvidence {
    readonly id: string;
    readonly file: SourceFile;
    readonly location: SecurityIr["symbols"][number]["location"];
  }
  interface GlobalAmbientMiddleware extends AmbientEvidence {
    readonly receiver: string;
    readonly offset: number;
  }
  const filesByPath = new Map(files.map((file) => [file.relativePath, file]));
  const symbolsById = new Map(securityIr.symbols.map((symbol) => [symbol.id, symbol]));
  const modulePathById = new Map(securityIr.modules.map((module) => [module.id, module.path]));
  const packageRoots = files
    .filter((file) => /(?:^|\/)package\.json$/u.test(file.relativePath))
    .map((file) => file.relativePath.replace(/(?:^|\/)package\.json$/u, ""))
    .sort((left, right) => right.length - left.length);
  const packageScope = (filePath: string): string =>
    packageRoots.find(
      (root) => root === "" || filePath === root || filePath.startsWith(`${root}/`),
    ) ?? "";
  const importsByPath = new Map<string, ReturnType<typeof findImports>["imports"]>();
  for (const file of files) {
    const parsed = parsedByPath.get(file.relativePath);
    if (parsed?.language === "javascript" || parsed?.language === "typescript") {
      importsByPath.set(file.relativePath, findImports(parsed).imports);
    }
  }
  const symbolText = (symbolId: string): { file: SourceFile; text: string } | undefined => {
    const symbol = symbolsById.get(symbolId);
    if (symbol === undefined) return undefined;
    const path = modulePathById.get(symbol.moduleId);
    const file = path === undefined ? undefined : filesByPath.get(path);
    return file === undefined
      ? undefined
      : {
          file,
          text: file.text.slice(symbol.location.start.offset, symbol.location.end.offset),
        };
  };
  const importsAny = (path: string, packages: ReadonlySet<string>): boolean =>
    [...(importsByPath.get(path)?.values() ?? [])].some((binding) => packages.has(binding.module));
  const expressSessionScopes = new Set<string>();
  const sameSiteMiddleware: Array<{
    readonly filePath: string;
    readonly receiver: string;
    readonly offset: number;
  }> = [];
  const globalAmbientMiddleware: GlobalAmbientMiddleware[] = [];
  for (const file of files) {
    const parsed = parsedByPath.get(file.relativePath);
    if (parsed?.language !== "javascript" && parsed?.language !== "typescript") continue;
    const imports = importsByPath.get(file.relativePath) ?? new Map<string, ImportBinding>();
    traverse(parsed.ast, {
      CallExpression(path_) {
        const chain = memberChain(path_.node.callee);
        if (chain?.properties.at(-1) !== "use") return;
        for (const argument of path_.node.arguments) {
          if (argument.type === "CallExpression" && argument.callee.type === "Identifier") {
            if (imports.get(argument.callee.name)?.module === "express-session") {
              expressSessionScopes.add(packageScope(file.relativePath));
              const start = argument.start ?? 0;
              const end = argument.end ?? start;
              if (/\bsameSite\s*:\s*["'](?:strict|lax)["']/iu.test(file.text.slice(start, end))) {
                sameSiteMiddleware.push({
                  filePath: file.relativePath,
                  receiver: chain.root,
                  offset: path_.node.start ?? 0,
                });
              }
            }
            continue;
          }
          if (argument.type !== "ArrowFunctionExpression" && argument.type !== "FunctionExpression")
            continue;
          const request =
            argument.params[0]?.type === "Identifier" ? argument.params[0].name : undefined;
          const response =
            argument.params[1]?.type === "Identifier" ? argument.params[1].name : undefined;
          const next =
            argument.params[2]?.type === "Identifier" ? argument.params[2].name : undefined;
          if (request === undefined || response === undefined || next === undefined) continue;
          const callbackText = file.text.slice(argument.start ?? 0, argument.end ?? 0);
          const escapedRequest = request.replaceAll(/[$]/g, "\\$");
          const escapedResponse = response.replaceAll(/[$]/g, "\\$");
          const escapedNext = next.replaceAll(/[$]/g, "\\$");
          const guardedSessionIdentity = new RegExp(
            `if\\s*\\(\\s*!\\s*${escapedRequest}(?:\\?\\.)?\\.session(?:\\?\\.)?\\.(?:user|userId|account|accountId|auth|authenticated|loggedin|passport|identity|subject)\\s*\\)[\\s\\S]{0,500}(?:return\\s+)?${escapedResponse}(?:\\?\\.)?\\.(?:redirect|status|sendStatus|end)\\s*\\(`,
            "u",
          ).test(callbackText);
          const continuesPipeline = new RegExp(`\\b${escapedNext}\\s*\\(`, "u").test(callbackText);
          if (guardedSessionIdentity && continuesPipeline) {
            const offset = path_.node.start ?? 0;
            const point = pointAt(file.text, offset);
            globalAmbientMiddleware.push({
              id: `global-session:${file.relativePath}:${offset}`,
              receiver: chain.root,
              offset,
              file,
              location: {
                path: file.relativePath,
                start: { ...point, offset },
                end: { ...point, offset },
              },
            });
          }
        }
      },
    });
  }
  const ambientEvidence = (symbolIds: readonly string[]): AmbientEvidence | undefined => {
    for (const symbolId of symbolIds) {
      const source = symbolText(symbolId);
      const symbol = symbolsById.get(symbolId);
      const request = symbol?.parameterNames[0] ?? "req";
      if (source === undefined || symbol === undefined) continue;
      const escaped = request.replaceAll(/[$]/g, "\\$");
      const session = new RegExp(
        `\\b${escaped}(?:\\?\\.)?\\.session(?:\\?\\.)?\\.(?:user|userId|account|accountId|auth|authenticated|loggedin|passport|identity|subject)\\b(?!\\s*=(?!=))`,
        "u",
      ).test(source.text);
      const cookie = new RegExp(
        `\\b${escaped}(?:\\?\\.)?\\.cookies(?:\\?\\.)?\\.(?:session|sessionId|sid|auth|authToken)\\b`,
        "iu",
      ).test(source.text);
      if ((session && expressSessionScopes.has(packageScope(source.file.relativePath))) || cookie)
        return { id: symbol.id, location: symbol.location, file: source.file };
    }
    return undefined;
  };
  const inlineRouteHandler = (
    route: SecurityIr["routes"][number],
  ):
    | {
        readonly id: string;
        readonly file: SourceFile;
        readonly text: string;
        readonly requestName: string;
        readonly location: SecurityIr["routes"][number]["location"];
      }
    | undefined => {
    const file = filesByPath.get(route.location.path);
    const parsed = parsedByPath.get(route.location.path);
    if (
      file === undefined ||
      (parsed?.language !== "javascript" && parsed?.language !== "typescript")
    )
      return undefined;
    let result:
      | {
          readonly id: string;
          readonly file: SourceFile;
          readonly text: string;
          readonly requestName: string;
          readonly location: SecurityIr["routes"][number]["location"];
        }
      | undefined;
    traverse(parsed.ast, {
      CallExpression(path_) {
        if (path_.node.start !== route.location.start.offset) return;
        const handler = path_.node.arguments.at(-1);
        if (handler?.type !== "ArrowFunctionExpression" && handler?.type !== "FunctionExpression")
          return;
        const requestName =
          handler.params[0]?.type === "Identifier" ? handler.params[0].name : "req";
        result = {
          id: `inline-handler:${route.id}`,
          file,
          text: file.text.slice(handler.start ?? 0, handler.end ?? 0),
          requestName,
          location: route.location,
        };
        path_.stop();
      },
    });
    return result;
  };
  const inlineAmbientEvidence = (
    handler: ReturnType<typeof inlineRouteHandler>,
  ): AmbientEvidence | undefined => {
    if (handler === undefined) return undefined;
    const escaped = handler.requestName.replaceAll(/[$]/g, "\\$");
    const session = new RegExp(
      `\\b${escaped}(?:\\?\\.)?\\.session(?:\\?\\.)?\\.(?:user|userId|account|accountId|auth|authenticated|loggedin|passport|identity|subject)\\b(?!\\s*=(?!=))`,
      "u",
    ).test(handler.text);
    const cookie = new RegExp(
      `\\b${escaped}(?:\\?\\.)?\\.cookies(?:\\?\\.)?\\.(?:session|sessionId|sid|auth|authToken)\\b`,
      "iu",
    ).test(handler.text);
    return (session && expressSessionScopes.has(packageScope(handler.file.relativePath))) || cookie
      ? handler
      : undefined;
  };
  const inlineEstablishesAmbientSession = (
    handler: ReturnType<typeof inlineRouteHandler>,
  ): boolean => {
    if (handler === undefined) return false;
    const escaped = handler.requestName.replaceAll(/[$]/g, "\\$");
    return new RegExp(
      `\\b${escaped}(?:\\?\\.)?\\.session(?:\\?\\.)?\\.(?:user|userId|account|accountId|auth|authenticated|loggedin|passport|identity|subject)\\b\\s*=(?!=)`,
      "u",
    ).test(handler.text);
  };
  const nonAmbientAuth = (symbolIds: readonly string[]): boolean =>
    symbolIds.some((symbolId) => {
      const source = symbolText(symbolId);
      if (source === undefined) return false;
      return (
        importsAny(source.file.relativePath, new Set(["jsonwebtoken", "jose"])) &&
        /\b(?:headers(?:\?\.)?\.authorization|get\s*\(\s*["']authorization["'])/iu.test(
          source.text,
        ) &&
        /\b(?:verify|jwtVerify)\s*\(/u.test(source.text)
      );
    });
  const handlerControl = (symbolIds: readonly string[]): boolean =>
    symbolIds.some((symbolId) => {
      const source = symbolText(symbolId);
      if (source === undefined) return false;
      const csrfToken =
        importsAny(source.file.relativePath, CSRF_PACKAGES) &&
        /\b(?:verifyToken|validateRequest|doubleCsrfProtection|csrfProtection)\s*\(/u.test(
          source.text,
        );
      const exactOrigin =
        /new\s+URL\s*\([^)]*(?:headers(?:\?\.)?\.origin|get\s*\(\s*["']origin["'])[^)]*\)\.origin/iu.test(
          source.text,
        ) &&
        /(?:===|!==)\s*(?:["']https?:\/\/[^"']+["']|APP_ORIGIN|appOrigin)|(?:ALLOWED_ORIGINS|allowedOrigins)\.has\s*\(/u.test(
          source.text,
        );
      return csrfToken || exactOrigin;
    });
  const inlineNonAmbientAuth = (handler: ReturnType<typeof inlineRouteHandler>): boolean =>
    handler !== undefined &&
    importsAny(handler.file.relativePath, new Set(["jsonwebtoken", "jose"])) &&
    /\b(?:headers(?:\?\.)?\.authorization|get\s*\(\s*["']authorization["'])/iu.test(handler.text) &&
    /\b(?:verify|jwtVerify)\s*\(/u.test(handler.text);
  const inlineHandlerControl = (handler: ReturnType<typeof inlineRouteHandler>): boolean =>
    handler !== undefined &&
    ((importsAny(handler.file.relativePath, CSRF_PACKAGES) &&
      /\b(?:verifyToken|validateRequest|doubleCsrfProtection|csrfProtection)\s*\(/u.test(
        handler.text,
      )) ||
      (/new\s+URL\s*\([^)]*(?:headers(?:\?\.)?\.origin|get\s*\(\s*["']origin["'])[^)]*\)\.origin/iu.test(
        handler.text,
      ) &&
        /(?:===|!==)\s*(?:["']https?:\/\/[^"']+["']|APP_ORIGIN|appOrigin)|(?:ALLOWED_ORIGINS|allowedOrigins)\.has\s*\(/u.test(
          handler.text,
        )));
  const sourceMutatesState = (file: SourceFile, text: string, requestName: string): boolean => {
    const escaped = requestName.replaceAll(/[$]/g, "\\$");
    const sessionMutation = new RegExp(
      `\\b${escaped}(?:\\?\\.)?\\.session(?:\\?\\.)?(?:\\.[A-Za-z_$][\\w$]*|\\[[^\\]]+\\])\\s*=(?!=)|\\b${escaped}(?:\\?\\.)?\\.session(?:\\?\\.)?\\.(?:destroy|regenerate)\\s*\\(`,
      "u",
    ).test(text);
    const processMutation =
      importsAny(file.relativePath, new Set(["node:child_process", "child_process"])) &&
      /\b(?:exec|execSync|spawn|spawnSync)\s*\(/u.test(text);
    const filesystemMutation =
      importsAny(file.relativePath, new Set(["node:fs", "fs"])) &&
      /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|unlink|unlinkSync|rename|renameSync)\s*\(/u.test(
        text,
      );
    return sessionMutation || processMutation || filesystemMutation;
  };
  const handlerMutatesState = (
    symbolIds: readonly string[],
    inlineHandler: ReturnType<typeof inlineRouteHandler>,
  ): boolean => {
    for (const symbolId of symbolIds) {
      const source = symbolText(symbolId);
      const symbol = symbolsById.get(symbolId);
      if (
        source !== undefined &&
        symbol !== undefined &&
        sourceMutatesState(source.file, source.text, symbol.parameterNames[0] ?? "req")
      )
        return true;
    }
    return (
      inlineHandler !== undefined &&
      sourceMutatesState(inlineHandler.file, inlineHandler.text, inlineHandler.requestName)
    );
  };
  const routeMiddlewareState = (route: SecurityIr["routes"][number]) => {
    const file = filesByPath.get(route.location.path);
    const parsed = parsedByPath.get(route.location.path);
    if (
      file === undefined ||
      (parsed?.language !== "javascript" && parsed?.language !== "typescript")
    )
      return { hasCsrf: false, unresolved: true, receiver: undefined as string | undefined };
    const imports = importsByPath.get(file.relativePath) ?? new Map<string, ImportBinding>();
    const resolvedNames = new Set(
      route.middlewareSymbolIds
        .map((id) => symbolsById.get(id)?.name)
        .filter((name): name is string => name !== undefined),
    );
    let result = { hasCsrf: false, unresolved: false, receiver: undefined as string | undefined };
    let routeReceiver: string | undefined;
    const globalCsrfReceivers = new Set<string>();
    const isCsrfArgument = (path_: NodePath<CallExpression>, argument: Node): boolean => {
      if (argument.type !== "Identifier") return false;
      const directImport = imports.get(argument.name);
      if (
        directImport !== undefined &&
        CSRF_PACKAGES.has(directImport.module) &&
        ["default", "csrfProtection", "doubleCsrfProtection"].includes(directImport.imported)
      )
        return true;
      const binding = path_.scope.getBinding(argument.name)?.path;
      if (binding?.isVariableDeclarator() && binding.node.init?.type === "CallExpression") {
        const callee = binding.node.init.callee;
        return (
          callee.type === "Identifier" && CSRF_PACKAGES.has(imports.get(callee.name)?.module ?? "")
        );
      }
      return false;
    };
    traverse(parsed.ast, {
      CallExpression(path_) {
        const chain = memberChain(path_.node.callee);
        if (
          (path_.node.start ?? Number.MAX_SAFE_INTEGER) < route.location.start.offset &&
          chain?.properties.at(-1) === "use" &&
          path_.node.arguments.some((argument) => isCsrfArgument(path_, argument))
        ) {
          globalCsrfReceivers.add(chain.root);
        }
        if (path_.node.start !== route.location.start.offset) return;
        routeReceiver = chain?.root;
        result = { ...result, receiver: routeReceiver };
        const middleware = path_.node.arguments.slice(1, -1);
        for (const argument of middleware) {
          if (argument.type !== "Identifier") {
            result = { ...result, unresolved: true };
            continue;
          }
          if (isCsrfArgument(path_, argument)) {
            result = { ...result, hasCsrf: true };
            continue;
          }
          if (!resolvedNames.has(argument.name)) result = { ...result, unresolved: true };
        }
      },
    });
    if (routeReceiver !== undefined && globalCsrfReceivers.has(routeReceiver)) {
      result = { ...result, hasCsrf: true };
    }
    return result;
  };
  const candidates: DataflowCandidate[] = [];
  for (const route of securityIr.routes) {
    if (!STATE_CHANGING_METHODS.has(route.method)) continue;
    metrics.pathsConsidered += 1;
    const inlineHandler = inlineRouteHandler(route);
    if (route.handlerSymbolId === undefined && inlineHandler === undefined) {
      unknowns.push({
        ruleId: "AS-CSRF-001",
        path: route.location.path,
        line: route.location.start.line,
        reasonCodes: ["INSUFFICIENT_DATAFLOW_PROOF"],
        explanation:
          "A state-changing Express route has an unresolved handler, so authentication and browser reachability are UNKNOWN.",
      });
      continue;
    }
    const symbolIds = [
      ...route.middlewareSymbolIds,
      ...(route.handlerSymbolId === undefined ? [] : [route.handlerSymbolId]),
    ];
    if (!handlerMutatesState(symbolIds, inlineHandler)) continue;
    const middleware = routeMiddlewareState(route);
    let ambient = ambientEvidence(symbolIds) ?? inlineAmbientEvidence(inlineHandler);
    if (ambient === undefined && middleware.receiver !== undefined) {
      ambient = globalAmbientMiddleware.find(
        (candidate) =>
          candidate.file.relativePath === route.location.path &&
          candidate.receiver === middleware.receiver &&
          candidate.offset < route.location.start.offset &&
          expressSessionScopes.has(packageScope(candidate.file.relativePath)),
      );
    }
    if (ambient === undefined && inlineEstablishesAmbientSession(inlineHandler)) continue;
    if (ambient === undefined && (nonAmbientAuth(symbolIds) || inlineNonAmbientAuth(inlineHandler)))
      continue;
    if (middleware.hasCsrf || handlerControl(symbolIds) || inlineHandlerControl(inlineHandler))
      continue;
    const sameSiteOnly =
      middleware.receiver !== undefined &&
      sameSiteMiddleware.some(
        (candidate) =>
          candidate.filePath === route.location.path &&
          candidate.receiver === middleware.receiver &&
          candidate.offset < route.location.start.offset,
      );
    const customResolvedMiddleware = route.middlewareSymbolIds.some(
      (id) => ambientEvidence([id]) === undefined && !handlerControl([id]) && !nonAmbientAuth([id]),
    );
    if (
      ambient === undefined ||
      middleware.unresolved ||
      customResolvedMiddleware ||
      sameSiteOnly
    ) {
      const reasons: RemediationReasonCode[] = ["INSUFFICIENT_DATAFLOW_PROOF"];
      if (middleware.unresolved) reasons.push("UNSUPPORTED_FRAMEWORK_PATTERN");
      unknowns.push({
        ruleId: "AS-CSRF-001",
        path: route.location.path,
        line: route.location.start.line,
        reasonCodes: [...new Set(reasons)],
        explanation:
          ambient === undefined
            ? "Authentication or ambient browser credential reliance is not proven for this state-changing Express route."
            : sameSiteOnly
              ? "SameSite cookie evidence exists, but request and deployment semantics are insufficient for universal CSRF proof."
              : "One or more route middleware controls have unsupported semantics, so CSRF control sufficiency is UNKNOWN.",
      });
      continue;
    }
    const file = filesByPath.get(route.location.path);
    if (file === undefined) continue;
    candidates.push({
      kind: "CSRF",
      file,
      startOffset: route.location.start.offset,
      endOffset: route.location.end.offset,
      message: `Proven ${route.method} ${route.path} relies on ambient browser credentials without a supported route-bound anti-CSRF control.`,
      affectedComponent: `Express ${route.method} ${route.path}`,
      proof: {
        schemaVersion: "1.0.0",
        source: {
          kind: "SOURCE",
          label:
            "Supported Express session/cookie authentication supplies an ambient browser credential",
          location: {
            path: ambient.file.relativePath,
            line: ambient.location.start.line,
            column: ambient.location.start.column,
          },
        },
        propagationPath: [
          {
            kind: "PROPAGATION",
            label: `Security IR binds ambient authentication to ${route.method} ${route.path}`,
            location: {
              path: route.location.path,
              line: route.location.start.line,
              column: route.location.start.column,
            },
          },
        ],
        sink: {
          kind: "SINK",
          label: `state-changing Express ${route.method} route ${route.path}`,
          location: {
            path: route.location.path,
            line: route.location.start.line,
            column: route.location.start.column,
          },
        },
        securityControlEncountered: false,
        securityControlEvaluation: "ABSENT",
        reachability: "likely",
        invariant:
          "AMBIENTLY_AUTHENTICATED_STATE_CHANGING_BROWSER_REQUESTS_MUST_PROVE_REQUEST_ORIGIN",
        conclusion:
          "The supported state-changing route is reachable with ambient credentials and no supported request-origin control is bound to it.",
        proofState: "PROVEN_INSECURE",
        analysisLimitations: [
          "CSRF proof is bounded to literal Express routes, repository-local ESM middleware/handler resolution, supported ambient credential evidence, and explicit route-bound controls.",
        ],
      },
      remediationReasons: [
        "BUSINESS_POLICY_REQUIRED",
        "ARCHITECTURE_CHANGE_REQUIRED",
        "VERIFICATION_INSUFFICIENT",
      ],
      fingerprintAnchor: `CSRF:${route.id}:${ambient.id}`,
    });
  }
  return candidates;
}

export function analyzeApplicationDataflow(
  files: readonly SourceFile[],
  parsedByPath: ReadonlyMap<string, ParsedSource>,
  securityIr?: SecurityIr,
): DataflowBuildResult {
  const metrics: MutableMetrics = {
    filesAnalyzed: 0,
    astNodesVisited: 0,
    factsCreated: 0,
    pathsConsidered: 0,
    iterations: 0,
    truncationEvents: 0,
  };
  const unknowns: ApplicationDataflowAnalysis["unknowns"] = [];
  const candidates: DataflowCandidate[] = [];
  let unsupported = 0;
  for (const file of files) {
    const parsed = parsedByPath.get(file.relativePath);
    if (parsed?.language === "javascript" || parsed?.language === "typescript") {
      candidates.push(...analyzeJavaScriptFile(file, parsed, metrics, unknowns).candidates);
    } else if (parsed?.language === "python") {
      candidates.push(...analyzePythonFile(file, parsed, metrics, unknowns).candidates);
    } else if (["javascript", "typescript", "python"].includes(file.language)) {
      unsupported += 1;
    }
  }
  if (securityIr !== undefined) {
    candidates.push(...analyzeExpressCsrf(files, parsedByPath, securityIr, metrics, unknowns));
  }
  let completeness: AnalysisCompleteness = "COMPLETE";
  if (metrics.truncationEvents > 0) completeness = "TRUNCATED";
  else if (unsupported > 0 || unknowns.length > 0) completeness = "PARTIAL";
  else if (metrics.filesAnalyzed === 0) completeness = "UNSUPPORTED";
  const analysis = applicationDataflowAnalysisSchema.parse({
    schemaVersion: "1.0.0",
    engineVersion: "1.0.0",
    completeness,
    metrics,
    unknowns: [...unknowns].sort((left, right) =>
      `${left.path}:${left.line}:${left.ruleId}`.localeCompare(
        `${right.path}:${right.line}:${right.ruleId}`,
      ),
    ),
    limitations: [
      "JavaScript/TypeScript propagation is bounded to direct assignments, aliases, object properties, templates, concatenation, resolved same-file calls, arguments, and returns.",
      "Python propagation is bounded to parsed decorated routes and local assignments; cross-function and cross-file Python propagation is unsupported.",
      "Unknown custom sanitizers and unresolved dynamic transformations produce UNKNOWN instead of an actionable finding.",
      "No target code, package script, hook, framework CLI, test, build, or arbitrary interpreter was executed.",
    ],
  });
  return {
    analysis,
    candidates: candidates.sort((left, right) =>
      `${left.file.relativePath}:${left.startOffset}:${left.kind}`.localeCompare(
        `${right.file.relativePath}:${right.startOffset}:${right.kind}`,
      ),
    ),
  };
}

export const DATAFLOW_RESOURCE_BOUNDS = {
  maxAstNodesPerFile: MAX_AST_NODES_PER_FILE,
  maxRepositoryAstNodes: MAX_REPOSITORY_AST_NODES,
  maxFacts: MAX_FACTS,
  maxIterations: MAX_ITERATIONS,
  maxEvidenceSteps: MAX_EVIDENCE_STEPS,
} as const;
