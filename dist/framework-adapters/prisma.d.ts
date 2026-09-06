import type { ParsedSource } from "../ast-analysis/parser.js";
import type { SourceFile } from "../repository-discovery/traverse.js";
import type { IrLocation, ResourceOperation, SecurityIr } from "../security-ir/model.js";
export interface PrismaSelectorCandidate {
    readonly field: string;
    readonly expression: string;
}
export interface PrismaOperationCandidate {
    readonly functionSymbolId: string;
    readonly resourceType: string;
    readonly operation: ResourceOperation["operation"];
    readonly selectors: readonly PrismaSelectorCandidate[];
    readonly location: IrLocation;
    readonly startOffset: number;
    readonly message: string;
}
export declare function analyzePrismaOperations(ir: SecurityIr, files: readonly SourceFile[], parsedByPath: ReadonlyMap<string, ParsedSource>): PrismaOperationCandidate[];
//# sourceMappingURL=prisma.d.ts.map