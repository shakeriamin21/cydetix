export function memberName(callee) {
    if (callee.type !== "MemberExpression" && callee.type !== "OptionalMemberExpression")
        return undefined;
    if (!callee.computed && callee.property.type === "Identifier")
        return callee.property.name;
    if (callee.computed && callee.property.type === "StringLiteral")
        return callee.property.value;
    return undefined;
}
export function objectProperty(object, name) {
    return object.properties.find((property) => {
        if (property.type === "SpreadElement")
            return false;
        if (!property.computed && property.key.type === "Identifier")
            return property.key.name === name;
        return property.key.type === "StringLiteral" && property.key.value === name;
    });
}
export function propertyExpression(property) {
    if (property?.type !== "ObjectProperty")
        return undefined;
    const value = property.value;
    if (value.type === "AssignmentPattern")
        return value.right;
    if (value.type === "RestElement")
        return undefined;
    return value;
}
export function asObject(value) {
    return value?.type === "ObjectExpression" ? value : undefined;
}
export function literalString(value) {
    if (value?.type === "StringLiteral")
        return value.value;
    if (value?.type === "TemplateLiteral" && value.expressions.length === 0) {
        return value.quasis[0]?.value.cooked ?? value.quasis[0]?.value.raw;
    }
    return undefined;
}
//# sourceMappingURL=babel-utils.js.map