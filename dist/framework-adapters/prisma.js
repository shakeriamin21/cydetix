import traverse from "@babel/traverse";
import { objectProperty, propertyExpression } from "../ast-analysis/babel-utils.js";
const OPERATIONS = {
    findUnique: "read-one",
    findFirst: "read-one",
    findMany: "read-many",
    create: "create",
    update: "update",
    delete: "delete",
};
function point(text, offset) {
    const safeOffset = Math.max(0, Math.min(offset, text.length));
    const lines = text.slice(0, safeOffset).split("\n");
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
function containingFunctionSymbol(ir, filePath, call) {
    const start = call.start;
    const end = call.end;
    if (typeof start !== "number" || typeof end !== "number")
        return undefined;
    return ir.symbols
        .filter((symbol) => symbol.location.path === filePath &&
        symbol.location.start.offset <= start &&
        symbol.location.end.offset >= end)
        .sort((left, right) => left.location.end.offset -
        left.location.start.offset -
        (right.location.end.offset - right.location.start.offset))[0];
}
function prismaTarget(call) {
    if (call.callee.type !== "MemberExpression" ||
        call.callee.computed ||
        call.callee.property.type !== "Identifier" ||
        call.callee.object.type !== "MemberExpression" ||
        call.callee.object.computed ||
        call.callee.object.object.type !== "Identifier" ||
        call.callee.object.object.name !== "prisma" ||
        call.callee.object.property.type !== "Identifier") {
        return undefined;
    }
    return {
        resourceType: call.callee.object.property.name,
        method: call.callee.property.name,
    };
}
function selectorObject(call, operation) {
    const argument = call.arguments[0];
    if (argument?.type !== "ObjectExpression")
        return undefined;
    if (operation === "create")
        return undefined;
    const where = propertyExpression(objectProperty(argument, "where"));
    return where?.type === "ObjectExpression" ? where : undefined;
}
function selectors(file, object) {
    if (object === undefined)
        return [];
    const result = [];
    for (const property of object.properties) {
        if (property.type !== "ObjectProperty" || property.computed)
            continue;
        const field = property.key.type === "Identifier"
            ? property.key.name
            : property.key.type === "StringLiteral"
                ? property.key.value
                : undefined;
        if (field === undefined ||
            property.value.type === "AssignmentPattern" ||
            property.value.type === "RestElement") {
            continue;
        }
        result.push({ field, expression: sourceText(file, property.value) });
    }
    return result;
}
function inspectCall(callPath, file, ir) {
    const target = prismaTarget(callPath.node);
    const operation = target === undefined ? undefined : OPERATIONS[target.method];
    const sourceLocation = location(file, callPath.node);
    const containing = containingFunctionSymbol(ir, file.relativePath, callPath.node);
    if (target === undefined ||
        operation === undefined ||
        sourceLocation === undefined ||
        containing === undefined ||
        typeof callPath.node.start !== "number") {
        return undefined;
    }
    const selected = selectors(file, selectorObject(callPath.node, operation));
    return {
        functionSymbolId: containing.id,
        resourceType: target.resourceType,
        operation,
        selectors: selected,
        location: sourceLocation,
        startOffset: callPath.node.start,
        message: `Prisma ${target.resourceType}.${target.method} accesses ${target.resourceType} with selector fields ${selected.map((item) => item.field).join(", ") || "none"}.`,
    };
}
export function analyzePrismaOperations(ir, files, parsedByPath) {
    const operations = [];
    for (const file of files) {
        const parsed = parsedByPath.get(file.relativePath);
        if (parsed?.language !== "javascript" && parsed?.language !== "typescript")
            continue;
        traverse(parsed.ast, {
            CallExpression(callPath) {
                const operation = inspectCall(callPath, file, ir);
                if (operation !== undefined)
                    operations.push(operation);
            },
        });
    }
    return operations.sort((left, right) => `${left.location.path}:${left.startOffset}`.localeCompare(`${right.location.path}:${right.startOffset}`));
}
//# sourceMappingURL=prisma.js.map