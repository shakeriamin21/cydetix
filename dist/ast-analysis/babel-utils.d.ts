import type { ArgumentPlaceholder, CallExpression, Expression, ObjectExpression, ObjectMethod, ObjectProperty, SpreadElement } from "@babel/types";
export declare function memberName(callee: CallExpression["callee"]): string | undefined;
export declare function objectProperty(object: ObjectExpression, name: string): ObjectProperty | ObjectMethod | undefined;
export declare function propertyExpression(property: ObjectProperty | ObjectMethod | undefined): Expression | undefined;
export declare function asObject(value: Expression | SpreadElement | ArgumentPlaceholder | null | undefined): ObjectExpression | undefined;
export declare function literalString(value: Expression | SpreadElement | ArgumentPlaceholder | null | undefined): string | undefined;
//# sourceMappingURL=babel-utils.d.ts.map