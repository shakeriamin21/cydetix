import traverse from "@babel/traverse";

import { literalString, memberName } from "../ast-analysis/babel-utils.js";
import type { Finding } from "../core/schema.js";
import { requireRule } from "../rule-engine/catalogue.js";
import { makeFinding, nodeRange } from "../rule-engine/finding.js";
import type { AnalysisContext, SecurityRule } from "../rule-engine/types.js";

const definition = requireRule("AS-PASSWORD-001");

const FAST_HASHES = new Set(["md5", "sha1", "sha-1", "sha256", "sha-256", "sha512", "sha-512"]);
const PASSWORD_CONTEXT = /\b(password|passwd|pwd|passphrase|credential)\b/i;

function analyzeJavaScript(context: AnalysisContext): Finding[] {
  if (context.parsed?.language !== "javascript" && context.parsed?.language !== "typescript")
    return [];
  const findings: Finding[] = [];
  traverse(context.parsed.ast, {
    CallExpression(callPath) {
      if (memberName(callPath.node.callee) !== "createHash") return;
      const algorithm = literalString(callPath.node.arguments[0])?.toLowerCase();
      if (algorithm === undefined || !FAST_HASHES.has(algorithm)) return;
      const container = callPath.findParent(
        (candidate) => candidate.isStatement() || candidate.isVariableDeclarator(),
      );
      const node = container?.node ?? callPath.node;
      const range = nodeRange(node);
      const hashRange = nodeRange(callPath.node);
      if (range === undefined || hashRange === undefined) return;
      const source = context.file.text.slice(range.start, range.end);
      if (!PASSWORD_CONTEXT.test(source)) return;
      findings.push(
        makeFinding({
          rule: definition,
          file: context.file,
          startOffset: hashRange.start,
          endOffset: hashRange.end,
          message: `${algorithm} is a fast general-purpose hash used in password-adjacent code.`,
          affectedComponent: "credential storage",
          reachability: "likely",
          fingerprintAnchor: `${algorithm}:${source}`,
        }),
      );
    },
  });
  return findings;
}

function analyzePython(context: AnalysisContext): Finding[] {
  if (context.parsed?.language !== "python") return [];
  const findings: Finding[] = [];
  const pattern =
    /hashlib\.(md5|sha1|sha256|sha512)\s*\(([^\n)]*(?:password|passwd|pwd|passphrase|credential)[^\n)]*)\)/gi;
  for (const match of context.file.text.matchAll(pattern)) {
    const algorithm = match.at(1);
    if (algorithm === undefined) continue;
    findings.push(
      makeFinding({
        rule: definition,
        file: context.file,
        startOffset: match.index,
        endOffset: match.index + match[0].length,
        message: `hashlib.${algorithm} is a fast hash used directly with password-adjacent input.`,
        affectedComponent: "credential storage",
        reachability: "likely",
        fingerprintAnchor: `python:${algorithm}:${match[0]}`,
      }),
    );
  }
  return findings;
}

export const passwordHashRule: SecurityRule = {
  definition,
  analyze(context) {
    return [...analyzeJavaScript(context), ...analyzePython(context)];
  },
};
