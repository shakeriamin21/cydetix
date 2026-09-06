import path from "node:path";
import traverse from "@babel/traverse";
import { securityIrId, securityIrSchema, } from "../security-ir/model.js";
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
const HTTP_METHODS = new Map([
    ["get", "GET"],
    ["post", "POST"],
    ["put", "PUT"],
    ["patch", "PATCH"],
    ["delete", "DELETE"],
]);
function point(text, offset) {
    const safeOffset = Math.max(0, Math.min(offset, text.length));
    const prefix = text.slice(0, safeOffset);
    const lines = prefix.split("\n");
    return { line: lines.length, column: lines.at(-1)?.length ?? 0, offset: safeOffset };
}
function location(file, node) {
    if (typeof node.start !== "number" || typeof node.end !== "number")
        return undefined;
    return {
        path: file.relativePath,
        start: point(file.text, node.start),
        end: point(file.text, node.end),
    };
}
function sourceText(file, node) {
    if (typeof node.start !== "number" || typeof node.end !== "number")
        return node.type;
    return file.text.slice(node.start, node.end).replaceAll(/\s+/g, " ").trim().slice(0, 240);
}
function exportedLocalNames(parsed) {
    const names = new Set();
    for (const statement of parsed.ast.program.body) {
        if (statement.type === "ExportNamedDeclaration") {
            const declaration = statement.declaration;
            if (declaration?.type === "FunctionDeclaration" && declaration.id !== null) {
                const name = declaration.id?.name;
                if (name !== undefined)
                    names.add(name);
            }
            else if (declaration?.type === "VariableDeclaration") {
                for (const item of declaration.declarations) {
                    if (item.id.type === "Identifier")
                        names.add(item.id.name);
                }
            }
            for (const specifier of statement.specifiers) {
                if (specifier.type === "ExportSpecifier") {
                    names.add(specifier.local.name);
                }
            }
        }
        else if (statement.type === "ExportDefaultDeclaration") {
            const declaration = statement.declaration;
            if (declaration.type === "Identifier")
                names.add(declaration.name);
            if (declaration.type === "FunctionDeclaration" && declaration.id !== null) {
                const name = declaration.id?.name;
                if (name !== undefined)
                    names.add(name);
            }
        }
    }
    return names;
}
function importBindings(state, declaration, evidenceId) {
    for (const specifier of declaration.specifiers) {
        const importedName = specifier.type === "ImportDefaultSpecifier"
            ? "default"
            : specifier.type === "ImportNamespaceSpecifier"
                ? "*"
                : specifier.imported.type === "Identifier"
                    ? specifier.imported.name
                    : specifier.imported.value;
        state.imports.set(specifier.local.name, {
            localName: specifier.local.name,
            importedName,
            source: declaration.source.value,
            evidenceId,
        });
    }
}
function candidateModulePaths(fromPath, specifier) {
    if (!specifier.startsWith("."))
        return [];
    const normalized = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), specifier));
    if (normalized === ".." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) {
        return [];
    }
    const extension = path.posix.extname(normalized);
    if (SOURCE_EXTENSIONS.includes(extension)) {
        const stem = normalized.slice(0, -extension.length);
        return [normalized, ...SOURCE_EXTENSIONS.map((candidate) => `${stem}${candidate}`)];
    }
    return [
        normalized,
        ...SOURCE_EXTENSIONS.map((candidate) => `${normalized}${candidate}`),
        ...SOURCE_EXTENSIONS.map((candidate) => `${normalized}/index${candidate}`),
    ];
}
function targetModule(modulesByPath, fromPath, specifier) {
    for (const candidate of candidateModulePaths(fromPath, specifier)) {
        const target = modulesByPath.get(candidate);
        if (target !== undefined)
            return target;
    }
    return undefined;
}
function bindingSymbol(callPath, state, modulesByPath, identifier) {
    const binding = callPath.scope.getBinding(identifier.name);
    if (binding !== undefined) {
        const direct = state.symbolsByDeclaration.get(binding.path.node) ??
            state.symbolsByDeclaration.get(binding.path.parentPath.node);
        if (direct !== undefined)
            return { symbol: direct };
    }
    const imported = state.imports.get(identifier.name);
    if (imported === undefined || imported.importedName === "*")
        return undefined;
    const target = targetModule(modulesByPath, state.file.relativePath, imported.source);
    const symbol = target?.exports.get(imported.importedName);
    return symbol === undefined ? undefined : { symbol, importEvidenceId: imported.evidenceId };
}
function namespaceMemberSymbol(callPath, state, modulesByPath) {
    const callee = callPath.node;
    if (callee.type !== "CallExpression" || callee.callee.type !== "MemberExpression") {
        return undefined;
    }
    if (callee.callee.object.type !== "Identifier" ||
        callee.callee.computed ||
        callee.callee.property.type !== "Identifier") {
        return undefined;
    }
    const imported = state.imports.get(callee.callee.object.name);
    if (imported?.importedName !== "*")
        return undefined;
    const target = targetModule(modulesByPath, state.file.relativePath, imported.source);
    const symbol = target?.exports.get(callee.callee.property.name);
    return symbol === undefined ? undefined : { symbol, importEvidenceId: imported.evidenceId };
}
function containingSymbol(callPath, state) {
    let cursor = callPath.parentPath;
    while (!cursor.isProgram()) {
        if (cursor.isFunction()) {
            const symbol = state.symbolsByDeclaration.get(cursor.node);
            if (symbol !== undefined)
                return symbol;
        }
        cursor = cursor.parentPath;
    }
    return undefined;
}
function calleeParts(call, file) {
    if (call.callee.type === "Identifier")
        return { calleeName: call.callee.name, dynamic: false };
    if (call.callee.type === "MemberExpression" || call.callee.type === "OptionalMemberExpression") {
        const property = call.callee.property;
        const calleeName = !call.callee.computed && property.type === "Identifier"
            ? property.name
            : sourceText(file, property);
        return {
            calleeName,
            receiver: sourceText(file, call.callee.object),
            dynamic: call.callee.computed,
        };
    }
    return { calleeName: sourceText(file, call.callee), dynamic: true };
}
function expressionText(file, expression) {
    return expression === null ? "null" : sourceText(file, expression);
}
function parameterNames(parameters) {
    return parameters.map((parameter) => parameter.type === "Identifier" ? parameter.name : `<${parameter.type}>`);
}
function routeMethod(call) {
    if (call.callee.type !== "MemberExpression" ||
        call.callee.computed ||
        call.callee.object.type !== "Identifier" ||
        !["app", "router"].includes(call.callee.object.name) ||
        call.callee.property.type !== "Identifier") {
        return undefined;
    }
    return HTTP_METHODS.get(call.callee.property.name.toLowerCase());
}
function sorted(values, key) {
    return [...values].sort((left, right) => key(left).localeCompare(key(right)));
}
export function buildSecurityIr(files, parsedByPath) {
    const modulesByPath = new Map();
    const modules = [];
    const symbols = [];
    const evidence = [];
    const edges = [];
    const calls = [];
    const routes = [];
    const allSymbolsByState = new Map();
    const addEvidence = (kind, file, node, message) => {
        const sourceLocation = location(file, node);
        if (sourceLocation === undefined)
            return undefined;
        const id = securityIrId("evidence", kind, file.relativePath, String(node.start ?? 0), message);
        if (!evidence.some((item) => item.id === id)) {
            evidence.push({ id, kind, location: sourceLocation, message });
        }
        return id;
    };
    for (const file of files) {
        const parsed = parsedByPath.get(file.relativePath);
        if (parsed?.language !== "javascript" && parsed?.language !== "typescript")
            continue;
        const module = {
            id: securityIrId("module", file.relativePath),
            path: file.relativePath,
            language: parsed.language,
        };
        const state = {
            file,
            parsed,
            module,
            symbolsByDeclaration: new WeakMap(),
            imports: new Map(),
            exports: new Map(),
            exportedLocals: exportedLocalNames(parsed),
        };
        modules.push(module);
        modulesByPath.set(file.relativePath, state);
        allSymbolsByState.set(state, []);
    }
    for (const state of modulesByPath.values()) {
        traverse(state.parsed.ast, {
            ImportDeclaration(importPath) {
                const evidenceId = addEvidence("import", state.file, importPath.node, `Static ESM import from ${importPath.node.source.value}.`);
                if (evidenceId !== undefined)
                    importBindings(state, importPath.node, evidenceId);
            },
            FunctionDeclaration(functionPath) {
                const name = functionPath.node.id?.name;
                const sourceLocation = location(state.file, functionPath.node);
                if (name === undefined || sourceLocation === undefined)
                    return;
                const symbol = {
                    id: securityIrId("symbol", state.file.relativePath, name, String(functionPath.node.start ?? 0)),
                    moduleId: state.module.id,
                    name,
                    kind: "function",
                    exported: state.exportedLocals.has(name),
                    parameterNames: parameterNames(functionPath.node.params),
                    location: sourceLocation,
                };
                symbols.push(symbol);
                allSymbolsByState.get(state)?.push(symbol);
                state.symbolsByDeclaration.set(functionPath.node, symbol);
            },
            VariableDeclarator(variablePath) {
                const node = variablePath.node;
                if (node.id.type !== "Identifier" ||
                    (node.init?.type !== "ArrowFunctionExpression" &&
                        node.init?.type !== "FunctionExpression")) {
                    return;
                }
                const sourceLocation = location(state.file, node);
                if (sourceLocation === undefined)
                    return;
                const symbol = {
                    id: securityIrId("symbol", state.file.relativePath, node.id.name, String(node.start ?? 0)),
                    moduleId: state.module.id,
                    name: node.id.name,
                    kind: "function",
                    exported: state.exportedLocals.has(node.id.name),
                    parameterNames: parameterNames(node.init.params),
                    location: sourceLocation,
                };
                symbols.push(symbol);
                allSymbolsByState.get(state)?.push(symbol);
                state.symbolsByDeclaration.set(node, symbol);
                state.symbolsByDeclaration.set(node.init, symbol);
            },
        });
    }
    for (const state of modulesByPath.values()) {
        const stateSymbols = allSymbolsByState.get(state) ?? [];
        for (const symbol of stateSymbols) {
            if (symbol.exported)
                state.exports.set(symbol.name, symbol);
        }
        for (const statement of state.parsed.ast.program.body) {
            if (statement.type === "ExportDefaultDeclaration") {
                const declaration = statement.declaration;
                const named = declaration.type === "Identifier"
                    ? stateSymbols.find((symbol) => symbol.name === declaration.name)
                    : state.symbolsByDeclaration.get(declaration);
                if (named !== undefined)
                    state.exports.set("default", named);
            }
            if (statement.type !== "ExportNamedDeclaration")
                continue;
            for (const specifier of statement.specifiers) {
                if (specifier.type !== "ExportSpecifier")
                    continue;
                const localName = specifier.local.name;
                const exportedName = specifier.exported.type === "Identifier"
                    ? specifier.exported.name
                    : specifier.exported.value;
                const symbol = stateSymbols.find((candidate) => candidate.name === localName);
                if (symbol !== undefined)
                    state.exports.set(exportedName, symbol);
            }
        }
        for (const [exportedName, symbol] of state.exports) {
            const evidenceId = addEvidence("declaration", state.file, state.parsed.ast.program, `Module exports ${exportedName} from ${symbol.name}.`);
            if (evidenceId !== undefined) {
                edges.push({
                    from: state.module.id,
                    to: symbol.id,
                    kind: "exports",
                    evidenceIds: [evidenceId],
                });
            }
        }
    }
    for (const state of modulesByPath.values()) {
        for (const imported of state.imports.values()) {
            const target = targetModule(modulesByPath, state.file.relativePath, imported.source);
            if (target !== undefined) {
                edges.push({
                    from: state.module.id,
                    to: target.module.id,
                    kind: "imports",
                    evidenceIds: [imported.evidenceId],
                });
            }
        }
        traverse(state.parsed.ast, {
            CallExpression(callPath) {
                const method = routeMethod(callPath.node);
                const routePath = callPath.node.arguments[0]?.type === "StringLiteral"
                    ? callPath.node.arguments[0].value
                    : undefined;
                if (method !== undefined && routePath !== undefined) {
                    const sourceLocation = location(state.file, callPath.node);
                    const evidenceId = addEvidence("route-binding", state.file, callPath.node, `Express ${method} route binds ${routePath}.`);
                    if (sourceLocation !== undefined && evidenceId !== undefined) {
                        const bindingArguments = callPath.node.arguments.slice(1);
                        const resolved = bindingArguments.map((argument) => argument.type === "Identifier"
                            ? bindingSymbol(callPath, state, modulesByPath, argument)
                            : undefined);
                        const handler = resolved.at(-1)?.symbol;
                        const middleware = resolved
                            .slice(0, -1)
                            .map((item) => item?.symbol)
                            .filter((item) => item !== undefined);
                        const routeId = securityIrId("route", state.file.relativePath, method, routePath, String(callPath.node.start ?? 0));
                        routes.push({
                            id: routeId,
                            moduleId: state.module.id,
                            framework: "Express",
                            method,
                            path: routePath,
                            ...(handler === undefined ? {} : { handlerSymbolId: handler.id }),
                            middlewareSymbolIds: middleware.map((item) => item.id),
                            location: sourceLocation,
                            evidenceIds: [evidenceId],
                        });
                        if (handler !== undefined) {
                            edges.push({
                                from: routeId,
                                to: handler.id,
                                kind: "binds-route",
                                evidenceIds: [evidenceId],
                            });
                        }
                    }
                }
                const caller = containingSymbol(callPath, state);
                const sourceLocation = location(state.file, callPath.node);
                if (caller === undefined || sourceLocation === undefined)
                    return;
                const parts = calleeParts(callPath.node, state.file);
                const resolved = callPath.node.callee.type === "Identifier"
                    ? bindingSymbol(callPath, state, modulesByPath, callPath.node.callee)
                    : namespaceMemberSymbol(callPath, state, modulesByPath);
                const resolution = resolved !== undefined ? "resolved" : parts.dynamic ? "dynamic" : "unresolved";
                const evidenceId = addEvidence("call", state.file, callPath.node, resolved === undefined
                    ? `Call target ${parts.calleeName} is ${resolution}.`
                    : `Call resolves to ${resolved.symbol.name} in ${resolved.symbol.location.path}.`);
                if (evidenceId === undefined)
                    return;
                const call = {
                    id: securityIrId("call", state.file.relativePath, caller.id, String(callPath.node.start ?? 0)),
                    callerSymbolId: caller.id,
                    calleeName: parts.calleeName,
                    ...(parts.receiver === undefined ? {} : { receiver: parts.receiver }),
                    resolution,
                    ...(resolved === undefined ? {} : { calleeSymbolId: resolved.symbol.id }),
                    arguments: callPath.node.arguments.map((argument, position) => ({
                        position,
                        expression: argument.type === "SpreadElement" || argument.type === "ArgumentPlaceholder"
                            ? sourceText(state.file, argument)
                            : expressionText(state.file, argument),
                        identityFactIds: [],
                    })),
                    location: sourceLocation,
                    evidenceIds: [evidenceId],
                };
                calls.push(call);
                if (resolved !== undefined) {
                    edges.push({
                        from: caller.id,
                        to: resolved.symbol.id,
                        kind: "calls",
                        evidenceIds: [evidenceId],
                    });
                }
            },
        });
    }
    const unresolved = calls.filter((call) => call.resolution !== "resolved").length;
    return securityIrSchema.parse({
        schemaVersion: "1.0.0",
        modules: sorted(modules, (item) => item.path),
        symbols: sorted(symbols, (item) => item.id),
        routes: sorted(routes, (item) => item.id),
        calls: sorted(calls, (item) => item.id),
        identities: [],
        resourceOperations: [],
        enforcements: [],
        evidence: sorted(evidence, (item) => item.id),
        edges: sorted(edges, (item) => `${item.from}:${item.kind}:${item.to}`),
        limitations: [
            "Cross-file call resolution is limited to repository-local relative ESM imports and statically named direct or namespace calls.",
            "CommonJS require, tsconfig path aliases, package exports, re-exports, dependency injection, decorators, computed properties, and runtime dispatch remain UNKNOWN.",
            "Express routes require literal paths and statically named handlers; inline and dynamically composed handlers remain UNKNOWN.",
            ...(unresolved === 0 ? [] : [`${unresolved} call target(s) remained unresolved or dynamic.`]),
        ],
    });
}
//# sourceMappingURL=builder.js.map