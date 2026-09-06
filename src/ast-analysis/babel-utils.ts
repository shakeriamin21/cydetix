import type {
  ArgumentPlaceholder,
  CallExpression,
  Expression,
  ObjectExpression,
  ObjectMethod,
  ObjectProperty,
  SpreadElement,
} from "@babel/types";

export function memberName(callee: CallExpression["callee"]): string | undefined {
  if (callee.type !== "MemberExpression" && callee.type !== "OptionalMemberExpression")
    return undefined;
  if (!callee.computed && callee.property.type === "Identifier") return callee.property.name;
  if (callee.computed && callee.property.type === "StringLiteral") return callee.property.value;
  return undefined;
}

export function objectProperty(
  object: ObjectExpression,
  name: string,
): ObjectProperty | ObjectMethod | undefined {
  return object.properties.find((property): property is ObjectProperty | ObjectMethod => {
    if (property.type === "SpreadElement") return false;
    if (!property.computed && property.key.type === "Identifier") return property.key.name === name;
    return property.key.type === "StringLiteral" && property.key.value === name;
  });
}

export function propertyExpression(
  property: ObjectProperty | ObjectMethod | undefined,
): Expression | undefined {
  if (property?.type !== "ObjectProperty") return undefined;
  const value = property.value;
  if (value.type === "AssignmentPattern") return value.right;
  if (value.type === "RestElement") return undefined;
  return value as Expression;
}

export function asObject(
  value: Expression | SpreadElement | ArgumentPlaceholder | null | undefined,
): ObjectExpression | undefined {
  return value?.type === "ObjectExpression" ? value : undefined;
}

export function literalString(
  value: Expression | SpreadElement | ArgumentPlaceholder | null | undefined,
): string | undefined {
  if (value?.type === "StringLiteral") return value.value;
  if (value?.type === "TemplateLiteral" && value.expressions.length === 0) {
    return value.quasis[0]?.value.cooked ?? value.quasis[0]?.value.raw;
  }
  return undefined;
}
