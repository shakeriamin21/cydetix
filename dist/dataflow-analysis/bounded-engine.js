import traverse from "@babel/traverse";
import { pointAt } from "../rule-engine/finding.js";
import { applicationDataflowAnalysisSchema, } from "./model.js";
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
function memberPropertyName(node) {
    if (node?.type === "Identifier" || node?.type === "PrivateName") {
        return node.type === "Identifier" ? node.name : undefined;
    }
    if (node?.type === "StringLiteral")
        return node.value;
    return undefined;
}
function memberChain(expression) {
    if (expression.type === "Identifier")
        return { root: expression.name, properties: [] };
    if (expression.type !== "MemberExpression" && expression.type !== "OptionalMemberExpression")
        return undefined;
    const parent = memberChain(expression.object);
    const property = memberPropertyName(expression.property);
    if (parent === undefined || property === undefined)
        return undefined;
    return { root: parent.root, properties: [...parent.properties, property] };
}
function functionName(node, fallback) {
    if ((node.type === "FunctionDeclaration" || node.type === "FunctionExpression") &&
        node.id != null)
        return node.id.name;
    return fallback;
}
function parameterNames(node) {
    return node.params.map((parameter) => {
        if (parameter.type === "Identifier")
            return parameter.name;
        if (parameter.type === "AssignmentPattern" && parameter.left.type === "Identifier")
            return parameter.left.name;
        return "";
    });
}
function functionId(file, node) {
    return `${file.relativePath}:${node.start ?? -1}`;
}
function scopeId(file, path_) {
    const owner = path_.getFunctionParent();
    return owner === null ? `${file.relativePath}:program` : functionId(file, owner.node);
}
function propertyKey(expression) {
    const chain = memberChain(expression);
    return chain === undefined ? undefined : `${chain.root}.${chain.properties.join(".")}`;
}
function literalModule(node) {
    return node?.type === "StringLiteral" ? node.value : undefined;
}
function requireModule(node) {
    if (node?.type !== "CallExpression" || node.callee.type !== "Identifier")
        return undefined;
    if (node.callee.name !== "require" || node.arguments.length !== 1)
        return undefined;
    return literalModule(node.arguments[0]);
}
function importedBinding(imports, name, modules, path_) {
    const binding = imports.get(name);
    const lexicalStart = path_.scope.getBinding(name)?.path.node.start;
    return binding !== undefined &&
        modules.has(binding.module) &&
        lexicalStart === binding.bindingStart
        ? binding
        : undefined;
}
function appendStep(fact, step, unknownControl = fact.unknownControl) {
    const steps = [...fact.steps, step].slice(0, MAX_EVIDENCE_STEPS);
    return { source: fact.source, steps, unknownControl };
}
function deterministicFact(facts) {
    const available = facts.filter((fact) => fact !== undefined);
    available.sort((left, right) => {
        const length = left.steps.length - right.steps.length;
        return length === 0
            ? `${left.source.path}:${left.source.offset}:${left.source.label}`.localeCompare(`${right.source.path}:${right.source.offset}:${right.source.label}`)
            : length;
    });
    return available[0];
}
function expressionArguments(call) {
    return [...call.arguments];
}
function objectPropertyValue(object, name) {
    for (const property of object.properties) {
        if (property.type !== "ObjectProperty")
            continue;
        const key = memberPropertyName(property.key);
        if (key !== name || property.value.type === "AssignmentPattern")
            continue;
        if (property.value.type === "RestElement")
            continue;
        return property.value;
    }
    return undefined;
}
function isTrueProperty(object, name) {
    const value = object === undefined ? undefined : objectPropertyValue(object, name);
    return value?.type === "BooleanLiteral" && value.value;
}
function isStaticString(node) {
    return (node?.type === "StringLiteral" ||
        (node?.type === "TemplateLiteral" && node.expressions.length === 0));
}
function staticallyUnreachable(path_) {
    let child = path_;
    for (const ancestor of path_.getAncestry()) {
        if (ancestor.isIfStatement() && ancestor.node.test.type === "BooleanLiteral") {
            if (child.key === "consequent" && !ancestor.node.test.value)
                return true;
            if (child.key === "alternate" && ancestor.node.test.value)
                return true;
        }
        if ((ancestor.isWhileStatement() || ancestor.isForStatement()) &&
            ancestor.node.test?.type === "BooleanLiteral" &&
            !ancestor.node.test.value) {
            return true;
        }
        child = ancestor;
    }
    return false;
}
function findImports(parsed) {
    const imports = new Map();
    const objectOrigins = new Map();
    traverse(parsed.ast, {
        ImportDeclaration(path_) {
            for (const specifier of path_.node.specifiers) {
                const imported = specifier.type === "ImportSpecifier"
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
                }
                else if (path_.node.id.type === "ObjectPattern") {
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
            if (path_.node.id.type !== "Identifier" || path_.node.init == null)
                return;
            const initializer = path_.node.init;
            if (initializer.type === "NewExpression" && initializer.callee.type === "Identifier") {
                const origin = imports.get(initializer.callee.name)?.module;
                if (origin !== undefined)
                    objectOrigins.set(path_.node.id.name, {
                        module: origin,
                        bindingStart: path_.node.start ?? -1,
                    });
            }
            if (initializer.type === "CallExpression" &&
                (initializer.callee.type === "MemberExpression" ||
                    initializer.callee.type === "OptionalMemberExpression")) {
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
function callDescriptor(call, imports, objectOrigins, path_) {
    if (call.callee.type === "Identifier") {
        const candidate = imports.get(call.callee.name);
        const binding = candidate?.bindingStart === path_.scope.getBinding(call.callee.name)?.path.node.start
            ? candidate
            : undefined;
        return {
            ...(binding === undefined ? {} : { module: binding.module, imported: binding.imported }),
            method: call.callee.name,
        };
    }
    const chain = memberChain(call.callee);
    if (chain === undefined)
        return {};
    const method = chain.properties.at(-1);
    const lexicalStart = path_.scope.getBinding(chain.root)?.path.node.start;
    const importOrigin = imports.get(chain.root);
    const objectOrigin = objectOrigins.get(chain.root);
    const origin = importOrigin !== undefined && importOrigin.bindingStart === lexicalStart
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
function pathConfined(source, expression, sinkOffset) {
    if (expression.type !== "Identifier")
        return false;
    const name = expression.name.replaceAll(/[$]/g, "\\$");
    const before = source.slice(0, sinkOffset);
    const canonical = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(?:path\\.)?resolve\\s*\\(`).test(before);
    if (!canonical)
        return false;
    const startsWithBoundary = new RegExp(`(?:if\\s*\\(\\s*!${name}\\.startsWith\\s*\\([^)]*(?:path\\.sep|[\\/\\\\]["'])[^)]*\\)\\s*\\)|${name}\\.startsWith\\s*\\([^)]*(?:path\\.sep|[\\/\\\\]["'])[^)]*\\))`).test(before);
    const relativeBoundary = new RegExp(`(?:path\\.)?relative\\s*\\([^,]+,\\s*${name}\\s*\\)[\\s\\S]{0,240}(?:startsWith\\s*\\(\\s*["']\\.\\.["']|isAbsolute)`).test(before);
    return startsWithBoundary || relativeBoundary;
}
function urlPolicyEnforced(source, expression, sinkOffset) {
    if (expression.type !== "Identifier")
        return false;
    const name = expression.name.replaceAll(/[$]/g, "\\$");
    const before = source.slice(0, sinkOffset);
    const parsed = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*new\\s+URL\\s*\\(`).test(before);
    const hostAllowlist = new RegExp(`(?:allowedHosts|allowedHostnames|ALLOWED_HOSTS|ALLOWED_HOSTNAMES)\\.has\\s*\\(\\s*${name}\\.hostname\\s*\\)`).test(before);
    const schemeRestricted = new RegExp(`${name}\\.protocol\\s*(?:===|!==)\\s*["']https:["']`).test(before);
    return parsed && hostAllowlist && schemeRestricted;
}
function proofStep(file, step) {
    const point = pointAt(file.text, step.offset);
    return {
        kind: step.kind,
        label: step.label,
        location: { path: step.path, line: point.line, column: point.column },
    };
}
function createCandidate(kind, file, call, fact, sinkLabel, message, invariant, controlEvaluation) {
    if (typeof call.start !== "number" || typeof call.end !== "number")
        return undefined;
    const sinkPoint = pointAt(file.text, call.start);
    return {
        kind,
        file,
        startOffset: call.start,
        endOffset: call.end,
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
        fingerprintAnchor: `${kind}:${file.relativePath}:${call.start}:${fact.source.offset}`,
    };
}
function analyzeJavaScriptFile(file, parsed, metrics, unknowns) {
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
    const functions = new Map();
    const functionNames = new Map();
    const programId = `${file.relativePath}:program`;
    const registerFunction = (node, fallback) => {
        const id = functionId(file, node);
        const name = functionName(node, fallback);
        const existing = functions.get(id);
        if (existing !== undefined)
            return existing;
        const info = {
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
            const fallback = path_.parentPath.isVariableDeclarator() && path_.parentPath.node.id.type === "Identifier"
                ? path_.parentPath.node.id.name
                : "anonymous";
            registerFunction(path_.node, fallback);
        },
        ArrowFunctionExpression(path_) {
            const fallback = path_.parentPath.isVariableDeclarator() && path_.parentPath.node.id.type === "Identifier"
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
    const callEdges = new Map();
    const routeResponseParameters = new Map();
    const markRouteArgument = (argument) => {
        if (argument === undefined)
            return;
        if (argument.type === "FunctionExpression" || argument.type === "ArrowFunctionExpression") {
            const info = functions.get(functionId(file, argument));
            if (info !== undefined)
                info.routeRoot = true;
            return;
        }
        if (argument.type === "Identifier") {
            const ids = functionNames.get(argument.name) ?? [];
            if (ids.length === 1) {
                const info = functions.get(ids[0] ?? "");
                if (info !== undefined)
                    info.routeRoot = true;
            }
        }
    };
    traverse(parsed.ast, {
        CallExpression(path_) {
            const chain = memberChain(path_.node.callee);
            const method = chain?.properties.at(-1)?.toLowerCase();
            const routeLexicalStart = chain === undefined ? undefined : path_.scope.getBinding(chain.root)?.path.node.start;
            const routeImport = chain === undefined ? undefined : imports.get(chain.root);
            const routeObject = chain === undefined ? undefined : objectOrigins.get(chain.root);
            const routeModule = routeImport !== undefined && routeImport.bindingStart === routeLexicalStart
                ? routeImport.module
                : routeObject !== undefined && routeObject.bindingStart === routeLexicalStart
                    ? routeObject.module
                    : undefined;
            if (method !== undefined &&
                ROUTE_METHODS.has(method) &&
                isStaticString(path_.node.arguments[0]) &&
                routeModule !== undefined &&
                ["express", "fastify"].includes(routeModule)) {
                for (const argument of path_.node.arguments.slice(1))
                    markRouteArgument(argument);
            }
            if (path_.node.callee.type === "Identifier") {
                const targets = functionNames.get(path_.node.callee.name) ?? [];
                if (targets.length === 1) {
                    const owner = scopeId(file, path_);
                    const edges = callEdges.get(owner) ?? new Set();
                    edges.add(targets[0] ?? "");
                    callEdges.set(owner, edges);
                }
            }
        },
        ExportNamedDeclaration(path_) {
            const declaration = path_.node.declaration;
            if (declaration?.type === "FunctionDeclaration" &&
                declaration.id != null &&
                ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(declaration.id.name)) {
                const info = functions.get(functionId(file, declaration));
                if (info !== undefined)
                    info.routeRoot = true;
            }
        },
        ExportDefaultDeclaration(path_) {
            const declaration = path_.node.declaration;
            if (declaration.type === "FunctionDeclaration") {
                const info = functions.get(functionId(file, declaration));
                if (info !== undefined && /(?:^|\/)pages\/api\//.test(file.relativePath))
                    info.routeRoot = true;
            }
        },
    });
    for (const info of functions.values()) {
        if (info.routeRoot && info.parameters[1] !== undefined) {
            routeResponseParameters.set(info.id, info.parameters[1]);
        }
    }
    const reachable = new Set([programId]);
    for (const info of functions.values())
        if (info.routeRoot)
            reachable.add(info.id);
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
        if (!changed)
            break;
    }
    for (const info of functions.values())
        info.reachable = reachable.has(info.id);
    const facts = new Map();
    const returns = new Map();
    const candidates = new Map();
    const unknownKeys = new Set();
    const key = (scope, name) => `${scope}\u0000${name}`;
    const putFact = (scope, name, fact) => {
        if (fact === undefined || facts.size >= MAX_FACTS)
            return false;
        const existing = facts.get(key(scope, name));
        if (existing !== undefined && existing.steps.length <= fact.steps.length)
            return false;
        facts.set(key(scope, name), fact);
        metrics.factsCreated += 1;
        return true;
    };
    const requestSource = (scope, expression) => {
        const info = functions.get(scope);
        if (info?.routeRoot !== true)
            return undefined;
        const request = info.parameters[0];
        if (request === undefined || request === "")
            return undefined;
        const chain = memberChain(expression);
        if (chain === undefined || chain.root !== request)
            return undefined;
        const first = chain.properties[0];
        if (!["query", "body", "params", "headers", "cookies", "nextUrl"].includes(first ?? ""))
            return undefined;
        const source = {
            kind: "SOURCE",
            label: `${chain.root}.${chain.properties.join(".")} is untrusted request input`,
            path: file.relativePath,
            offset: expression.start ?? 0,
        };
        return { source, steps: [], unknownControl: false };
    };
    const evaluate = (scope, expression) => {
        if (expression === undefined || expression === null)
            return undefined;
        const direct = requestSource(scope, expression);
        if (direct !== undefined)
            return direct;
        if (expression.type === "Identifier")
            return facts.get(key(scope, expression.name));
        if (expression.type === "TSAsExpression" ||
            expression.type === "TSTypeAssertion" ||
            expression.type === "TSNonNullExpression" ||
            expression.type === "TypeCastExpression" ||
            expression.type === "ParenthesizedExpression") {
            return evaluate(scope, expression.expression);
        }
        if (expression.type === "AwaitExpression")
            return evaluate(scope, expression.argument);
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
            return deterministicFact(expression.properties.map((property) => property.type === "ObjectProperty" ? evaluate(scope, property.value) : undefined));
        }
        if (expression.type === "NewExpression" && expression.callee.type === "Identifier") {
            const fact = deterministicFact(expression.arguments.map((argument) => evaluate(scope, argument)));
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
            const info = expression.callee.type === "Identifier"
                ? (() => {
                    const ids = functionNames.get(expression.callee.name) ?? [];
                    return ids.length === 1 ? functions.get(ids[0] ?? "") : undefined;
                })()
                : undefined;
            if (info !== undefined)
                return returns.get(info.id);
            if (chain !== undefined &&
                chain.root === functions.get(scope)?.parameters[0] &&
                chain.properties.includes("nextUrl") &&
                chain.properties.includes("searchParams") &&
                chain.properties.at(-1) === "get") {
                const source = {
                    kind: "SOURCE",
                    label: `${chain.root}.${chain.properties.join(".")} reads untrusted request input`,
                    path: file.relativePath,
                    offset: expression.start ?? 0,
                };
                return { source, steps: [], unknownControl: false };
            }
            const argumentFact = deterministicFact(expression.arguments.map((argument) => evaluate(scope, argument)));
            if (argumentFact === undefined)
                return undefined;
            const calleeName = expression.callee.type === "Identifier"
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
            return appendStep(argumentFact, {
                kind: "TRANSFORMATION",
                label: `${calleeName}(...) ${preserving.has(calleeName) ? "preserves untrusted influence" : "has unknown security semantics"}`,
                path: file.relativePath,
                offset: expression.start ?? 0,
            }, argumentFact.unknownControl || !preserving.has(calleeName));
        }
        return undefined;
    };
    const recordUnknown = (ruleId, call, reasonCodes, explanation) => {
        const offset = call.start ?? 0;
        const unknownKey = `${ruleId}:${file.relativePath}:${offset}`;
        if (unknownKeys.has(unknownKey))
            return;
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
                if (scope !== programId && info?.reachable !== true)
                    return;
                const fact = evaluate(scope, path_.node.init);
                if (path_.node.id.type === "Identifier") {
                    iterationState.changed =
                        putFact(scope, path_.node.id.name, fact === undefined
                            ? undefined
                            : appendStep(fact, {
                                kind: "PROPAGATION",
                                label: `assigned to ${path_.node.id.name}`,
                                path: file.relativePath,
                                offset: path_.node.start ?? 0,
                            })) || iterationState.changed;
                    if (path_.node.init?.type === "ObjectExpression") {
                        for (const property of path_.node.init.properties) {
                            if (property.type !== "ObjectProperty")
                                continue;
                            const propertyName = memberPropertyName(property.key);
                            if (propertyName === undefined)
                                continue;
                            iterationState.changed =
                                putFact(scope, `${path_.node.id.name}.${propertyName}`, evaluate(scope, property.value)) || iterationState.changed;
                        }
                    }
                }
                else if (path_.node.id.type === "ObjectPattern" && fact !== undefined) {
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
                if (scope !== programId && info?.reachable !== true)
                    return;
                const name = propertyKey(path_.node.left);
                if (name !== undefined)
                    iterationState.changed =
                        putFact(scope, name, evaluate(scope, path_.node.right)) || iterationState.changed;
            },
            ReturnStatement(path_) {
                const scope = scopeId(file, path_);
                const info = functions.get(scope);
                if (info?.reachable !== true)
                    return;
                const fact = evaluate(scope, path_.node.argument);
                const existing = returns.get(scope);
                if (fact !== undefined &&
                    (existing === undefined || fact.steps.length < existing.steps.length)) {
                    returns.set(scope, fact);
                    iterationState.changed = true;
                }
            },
            CallExpression(path_) {
                if (staticallyUnreachable(path_))
                    return;
                const scope = scopeId(file, path_);
                const info = functions.get(scope);
                if (scope !== programId && info?.reachable !== true)
                    return;
                metrics.pathsConsidered += 1;
                const call = path_.node;
                if (call.callee.type === "Identifier") {
                    const targets = functionNames.get(call.callee.name) ?? [];
                    const callee = targets.length === 1 ? functions.get(targets[0] ?? "") : undefined;
                    if (callee !== undefined) {
                        const arguments_ = expressionArguments(call);
                        for (let index = 0; index < callee.parameters.length; index += 1) {
                            const parameter = callee.parameters[index];
                            if (parameter === undefined || parameter === "")
                                continue;
                            const fact = evaluate(scope, arguments_[index]);
                            iterationState.changed =
                                putFact(callee.id, parameter, fact === undefined
                                    ? undefined
                                    : appendStep(fact, {
                                        kind: "PROPAGATION",
                                        label: `passed as argument ${index + 1} to ${callee.name}(${parameter})`,
                                        path: file.relativePath,
                                        offset: call.start ?? 0,
                                    })) || iterationState.changed;
                        }
                    }
                }
                const descriptor = callDescriptor(call, imports, objectOrigins, path_);
                const arguments_ = expressionArguments(call);
                const first = arguments_[0];
                const firstFact = evaluate(scope, first);
                const add = (candidate) => {
                    if (candidate !== undefined)
                        candidates.set(candidate.fingerprintAnchor, candidate);
                };
                const sqlMethod = descriptor.method;
                const sqlSink = descriptor.module !== undefined &&
                    SQL_MODULES.has(descriptor.module) &&
                    ["query", "execute", "exec", "raw", "$queryRawUnsafe", "$executeRawUnsafe"].includes(sqlMethod ?? "");
                if (sqlSink && firstFact !== undefined) {
                    if (firstFact.unknownControl) {
                        recordUnknown("AS-INJECTION-SQL-001", call, ["SANITIZER_UNKNOWN", "INSUFFICIENT_DATAFLOW_PROOF"], "Untrusted data reaches an unrecognized transformation before a SQL sink; Cydetix cannot prove whether it affects SQL structure.");
                    }
                    else {
                        add(createCandidate("SQL_INJECTION", file, call, firstFact, `${descriptor.module}.${sqlMethod}`, "Proven untrusted request data controls SQL statement structure at a recognized database sink without separate parameterization.", "UNTRUSTED_SQL_DATA_MUST_NOT_CONTROL_SQL_STRUCTURE", "ABSENT"));
                    }
                }
                const commandBinding = call.callee.type === "Identifier"
                    ? importedBinding(imports, call.callee.name, COMMAND_MODULES, path_)
                    : undefined;
                const commandMethod = commandBinding?.imported ?? descriptor.method;
                const commandModule = commandBinding?.module ?? descriptor.module;
                const shellString = commandModule !== undefined &&
                    COMMAND_MODULES.has(commandModule) &&
                    ["exec", "execSync"].includes(commandMethod ?? "");
                const spawnWithShell = commandModule !== undefined &&
                    COMMAND_MODULES.has(commandModule) &&
                    ["spawn", "spawnSync"].includes(commandMethod ?? "") &&
                    isTrueProperty(arguments_.findLast((argument) => argument.type === "ObjectExpression"), "shell");
                const commandFact = spawnWithShell
                    ? deterministicFact(arguments_.slice(0, 2).map((argument) => evaluate(scope, argument)))
                    : firstFact;
                if ((shellString || spawnWithShell) && commandFact !== undefined) {
                    if (commandFact.unknownControl) {
                        recordUnknown("AS-INJECTION-CMD-001", call, ["SANITIZER_UNKNOWN", "INSUFFICIENT_DATAFLOW_PROOF"], "Untrusted data reaches an unknown transformation before shell execution; control sufficiency is UNKNOWN.");
                    }
                    else {
                        add(createCandidate("COMMAND_INJECTION", file, call, commandFact, `${commandModule}.${commandMethod}`, "Proven untrusted request data controls a shell command string or shell-enabled process invocation.", "UNTRUSTED_INPUT_MUST_NOT_CONTROL_SHELL_SYNTAX", "ABSENT"));
                    }
                }
                const filesystemBinding = call.callee.type === "Identifier"
                    ? importedBinding(imports, call.callee.name, FILESYSTEM_MODULES, path_)
                    : undefined;
                const filesystemMethod = filesystemBinding?.imported ?? descriptor.method;
                const filesystemModule = filesystemBinding?.module ?? descriptor.module;
                const responseParameter = routeResponseParameters.get(scope);
                const responseSink = descriptor.receiver === responseParameter &&
                    ["sendFile", "download"].includes(filesystemMethod ?? "");
                const filesystemSink = (filesystemModule !== undefined &&
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
                    }
                    else if (firstFact.unknownControl) {
                        recordUnknown("AS-PATH-001", call, ["SANITIZER_UNKNOWN", "INSUFFICIENT_DATAFLOW_PROOF"], "An unknown path transformation precedes a filesystem sink; canonical confinement cannot be proven.");
                    }
                    else {
                        add(createCandidate("PATH_TRAVERSAL", file, call, firstFact, responseSink
                            ? `Express response.${filesystemMethod}`
                            : `${filesystemModule}.${filesystemMethod}`, "Proven untrusted request data reaches a filesystem path sink without a recognized canonical authorized-root confinement check.", "UNTRUSTED_PATHS_MUST_REMAIN_WITHIN_AUTHORIZED_FILESYSTEM_ROOT", "ABSENT"));
                    }
                }
                const httpBinding = call.callee.type === "Identifier"
                    ? importedBinding(imports, call.callee.name, HTTP_MODULES, path_)
                    : undefined;
                const httpModule = httpBinding?.module ?? descriptor.module;
                const httpMethod = httpBinding?.imported ?? descriptor.method;
                const globalFetch = call.callee.type === "Identifier" &&
                    call.callee.name === "fetch" &&
                    path_.scope.getBinding("fetch") === undefined &&
                    scope !== programId;
                const httpSink = globalFetch ||
                    (httpModule !== undefined &&
                        HTTP_MODULES.has(httpModule) &&
                        ["default", "fetch", "request", "get", "post", "put", "patch", "delete"].includes(httpMethod ?? ""));
                let destination = first;
                if (httpSink &&
                    first?.type === "ObjectExpression" &&
                    objectPropertyValue(first, "url") !== undefined) {
                    destination = objectPropertyValue(first, "url");
                }
                const destinationFact = evaluate(scope, destination);
                if (httpSink && destination !== undefined && destinationFact !== undefined) {
                    if (urlPolicyEnforced(file.text, destination, call.start ?? 0)) {
                        // Exact hostname allowlist plus scheme restriction is a recognized control.
                    }
                    else if (destinationFact.unknownControl) {
                        recordUnknown("AS-SSRF-001", call, ["SANITIZER_UNKNOWN", "INSUFFICIENT_DATAFLOW_PROOF"], "An unknown URL transformation precedes an HTTP sink; destination policy enforcement is UNKNOWN.");
                    }
                    else {
                        add(createCandidate("SSRF", file, call, destinationFact, globalFetch ? "global fetch" : `${httpModule}.${httpMethod}`, "Proven untrusted request data controls the destination of a recognized server-side HTTP request without an enforced destination policy.", "UNTRUSTED_NETWORK_DESTINATION_MUST_NOT_CONTROL_SERVER_SIDE_REQUEST_TARGET_WITHOUT_ENFORCED_POLICY", "ABSENT"));
                    }
                }
            },
        });
        if (!iterationState.changed)
            break;
        if (facts.size >= MAX_FACTS) {
            metrics.truncationEvents += 1;
            return { candidates: [], truncated: true };
        }
    }
    return {
        candidates: [...candidates.values()].sort((left, right) => left.startOffset - right.startOffset),
        truncated: false,
    };
}
function pythonImports(source) {
    const modules = new Set();
    for (const match of source.matchAll(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm)) {
        const module = match[1] ?? match[2];
        if (module !== undefined)
            modules.add(module.split(".")[0] ?? module);
    }
    return modules;
}
function analyzePythonFile(file, parsed, metrics, unknowns) {
    const cursor = parsed.ast.cursor();
    const executableRanges = [];
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
    const routeFunctions = [];
    for (const range of executableRanges.filter((item) => item.name === "FunctionDefinition")) {
        const header = file.text.slice(range.from, Math.min(range.to, file.text.indexOf("\n", range.from)));
        const parameters = /def\s+\w+\s*\(([^)]*)\)/
            .exec(header)?.[1]
            ?.split(",")
            .map((item) => item.trim().split(/[=:]/)[0]?.trim() ?? "")
            .filter(Boolean) ?? [];
        const prefix = file.text.slice(Math.max(0, range.from - 240), range.from);
        if (/@(?:app|router)\.(?:get|post|put|patch|delete)\s*\([^\n]*\)\s*$/.test(prefix)) {
            routeFunctions.push({ from: range.from, to: range.to, parameters });
        }
    }
    const containingRoute = (offset) => routeFunctions.find((route) => offset >= route.from && offset <= route.to);
    const facts = new Map();
    const candidates = [];
    const expressionFact = (text, offset, route) => {
        const flaskSource = /\brequest\.(?:args|form|json|values|headers|cookies)(?:\b|\[)/.exec(text);
        if (flaskSource !== null && imports.has("flask")) {
            return {
                sourceOffset: offset + flaskSource.index,
                sourceLabel: `${flaskSource[0]} is untrusted Flask request input`,
                steps: [],
                unknownControl: false,
            };
        }
        if (route !== undefined) {
            for (const parameter of route.parameters) {
                if (parameter !== "self" && new RegExp(`\\b${parameter}\\b`).test(text)) {
                    return (facts.get(`${route.from}:${parameter}`) ?? {
                        sourceOffset: route.from,
                        sourceLabel: `${parameter} is request-bound FastAPI input`,
                        steps: [],
                        unknownControl: false,
                    });
                }
            }
        }
        const used = [...facts.entries()]
            .filter(([qualifiedName]) => route !== undefined &&
            qualifiedName.startsWith(`${route.from}:`) &&
            new RegExp(`\\b${qualifiedName.slice(qualifiedName.indexOf(":") + 1)}\\b`).test(text))
            .map(([, fact]) => fact)
            .sort((left, right) => left.steps.length - right.steps.length)[0];
        if (used === undefined)
            return undefined;
        const customCall = /\b(?!str\b|quote\b|urlencode\b)[A-Za-z_]\w*\s*\(/.test(text);
        return {
            ...used,
            steps: [
                ...used.steps,
                { label: `propagates through ${text.trim().slice(0, 80)}`, offset },
            ].slice(0, MAX_EVIDENCE_STEPS),
            unknownControl: used.unknownControl || customCall,
        };
    };
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
        metrics.iterations = Math.max(metrics.iterations, iteration + 1);
        let changed = false;
        for (const range of executableRanges.filter((item) => item.name === "AssignStatement")) {
            const route = containingRoute(range.from);
            if (route === undefined)
                continue;
            const statement = file.text.slice(range.from, range.to);
            const assignment = /^\s*([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/.exec(statement);
            if (assignment === null)
                continue;
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
        if (!changed)
            break;
    }
    const addPythonCandidate = (kind, range, fact, sink, message, invariant) => {
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
                        kind: "PROPAGATION",
                        label: step.label,
                        location: { path: file.relativePath, line: point.line, column: point.column },
                    };
                }),
                sink: {
                    kind: "SINK",
                    label: sink,
                    location: { path: file.relativePath, line: sinkPoint.line, column: sinkPoint.column },
                },
                securityControlEncountered: false,
                securityControlEvaluation: "ABSENT",
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
        if (route === undefined)
            continue;
        metrics.pathsConsidered += 1;
        const callText = file.text.slice(range.from, range.to);
        const argumentText = /^.*?\((.*)\)$/s.exec(callText)?.[1] ?? "";
        const firstArgument = argumentText.split(",")[0] ?? "";
        const fact = expressionFact(firstArgument, range.from + callText.indexOf(firstArgument), route);
        if (fact === undefined)
            continue;
        const unknown = (ruleId, explanation) => {
            unknowns.push({
                ruleId,
                path: file.relativePath,
                line: pointAt(file.text, range.from).line,
                reasonCodes: ["SANITIZER_UNKNOWN", "INSUFFICIENT_DATAFLOW_PROOF"],
                explanation,
            });
        };
        if (/\.(?:execute|executemany|executescript)\s*\(/.test(callText) &&
            [...imports].some((module) => ["sqlite3", "psycopg", "sqlalchemy"].includes(module))) {
            if (fact.unknownControl)
                unknown("AS-INJECTION-SQL-001", "SQL control semantics are UNKNOWN.");
            else
                addPythonCandidate("SQL_INJECTION", range, fact, "Python database execute API", "Proven untrusted request data controls SQL structure at an imported database API.", "UNTRUSTED_SQL_DATA_MUST_NOT_CONTROL_SQL_STRUCTURE");
        }
        const command = (imports.has("os") && /\bos\.system\s*\(/.test(callText)) ||
            (imports.has("subprocess") &&
                /\bsubprocess\.(?:run|call|Popen|check_output|check_call)\s*\(/.test(callText) &&
                /\bshell\s*=\s*True\b/.test(argumentText));
        if (command) {
            if (fact.unknownControl)
                unknown("AS-INJECTION-CMD-001", "Shell control semantics are UNKNOWN.");
            else
                addPythonCandidate("COMMAND_INJECTION", range, fact, "Python shell execution API", "Proven untrusted request data controls shell syntax.", "UNTRUSTED_INPUT_MUST_NOT_CONTROL_SHELL_SYNTAX");
        }
        const filesystem = /\bopen\s*\(/.test(callText) ||
            (/\b(?:os|pathlib)\./.test(callText) &&
                /(?:remove|unlink|rename|stat|open|read_text|write_text)\s*\(/.test(callText));
        if (filesystem) {
            const before = file.text.slice(route.from, range.from);
            const name = /^\s*([A-Za-z_]\w*)\s*$/.exec(firstArgument)?.[1];
            const confined = name !== undefined &&
                new RegExp(`\\b${name}\\s*=.*\\.resolve\\s*\\(`, "s").test(before) &&
                new RegExp(`\\b${name}\\.relative_to\\s*\\(`).test(before);
            if (!confined) {
                if (fact.unknownControl)
                    unknown("AS-PATH-001", "Path confinement is UNKNOWN.");
                else
                    addPythonCandidate("PATH_TRAVERSAL", range, fact, "Python filesystem API", "Proven untrusted request data reaches a filesystem sink without canonical confinement.", "UNTRUSTED_PATHS_MUST_REMAIN_WITHIN_AUTHORIZED_FILESYSTEM_ROOT");
            }
        }
        const http = [...imports].some((module) => ["requests", "httpx", "urllib"].includes(module)) &&
            /\.(?:get|post|put|patch|delete|request|urlopen)\s*\(/.test(callText);
        if (http) {
            const before = file.text.slice(route.from, range.from);
            const name = /^\s*([A-Za-z_]\w*)\s*$/.exec(firstArgument)?.[1];
            const policy = name !== undefined &&
                new RegExp(`urlparse\\s*\\([^)]*${name}[^)]*\\)`).test(before) &&
                /(?:ALLOWED_HOSTS|allowed_hosts)/.test(before) &&
                /\.scheme\s*(?:==|!=)\s*["']https["']/.test(before);
            if (!policy) {
                if (fact.unknownControl)
                    unknown("AS-SSRF-001", "Network destination policy is UNKNOWN.");
                else
                    addPythonCandidate("SSRF", range, fact, "Python server-side HTTP client", "Proven untrusted request data controls a server-side request destination.", "UNTRUSTED_NETWORK_DESTINATION_MUST_NOT_CONTROL_SERVER_SIDE_REQUEST_TARGET_WITHOUT_ENFORCED_POLICY");
            }
        }
    }
    return { candidates, truncated: false };
}
export function analyzeApplicationDataflow(files, parsedByPath) {
    const metrics = {
        filesAnalyzed: 0,
        astNodesVisited: 0,
        factsCreated: 0,
        pathsConsidered: 0,
        iterations: 0,
        truncationEvents: 0,
    };
    const unknowns = [];
    const candidates = [];
    let unsupported = 0;
    for (const file of files) {
        const parsed = parsedByPath.get(file.relativePath);
        if (parsed?.language === "javascript" || parsed?.language === "typescript") {
            candidates.push(...analyzeJavaScriptFile(file, parsed, metrics, unknowns).candidates);
        }
        else if (parsed?.language === "python") {
            candidates.push(...analyzePythonFile(file, parsed, metrics, unknowns).candidates);
        }
        else if (["javascript", "typescript", "python"].includes(file.language)) {
            unsupported += 1;
        }
    }
    let completeness = "COMPLETE";
    if (metrics.truncationEvents > 0)
        completeness = "TRUNCATED";
    else if (unsupported > 0 || unknowns.length > 0)
        completeness = "PARTIAL";
    else if (metrics.filesAnalyzed === 0)
        completeness = "UNSUPPORTED";
    const analysis = applicationDataflowAnalysisSchema.parse({
        schemaVersion: "1.0.0",
        engineVersion: "1.0.0",
        completeness,
        metrics,
        unknowns: [...unknowns].sort((left, right) => `${left.path}:${left.line}:${left.ruleId}`.localeCompare(`${right.path}:${right.line}:${right.ruleId}`)),
        limitations: [
            "JavaScript/TypeScript propagation is bounded to direct assignments, aliases, object properties, templates, concatenation, resolved same-file calls, arguments, and returns.",
            "Python propagation is bounded to parsed decorated routes and local assignments; cross-function and cross-file Python propagation is unsupported.",
            "Unknown custom sanitizers and unresolved dynamic transformations produce UNKNOWN instead of an actionable finding.",
            "No target code, package script, hook, framework CLI, test, build, or arbitrary interpreter was executed.",
        ],
    });
    return {
        analysis,
        candidates: candidates.sort((left, right) => `${left.file.relativePath}:${left.startOffset}:${left.kind}`.localeCompare(`${right.file.relativePath}:${right.startOffset}:${right.kind}`)),
    };
}
export const DATAFLOW_RESOURCE_BOUNDS = {
    maxAstNodesPerFile: MAX_AST_NODES_PER_FILE,
    maxRepositoryAstNodes: MAX_REPOSITORY_AST_NODES,
    maxFacts: MAX_FACTS,
    maxIterations: MAX_ITERATIONS,
    maxEvidenceSteps: MAX_EVIDENCE_STEPS,
};
//# sourceMappingURL=bounded-engine.js.map