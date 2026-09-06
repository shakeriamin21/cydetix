import type { ParsedSource } from "../ast-analysis/parser.js";
import type { SourceFile } from "../repository-discovery/traverse.js";
import { type SecurityIr } from "../security-ir/model.js";
export declare function buildSecurityIr(files: readonly SourceFile[], parsedByPath: ReadonlyMap<string, ParsedSource>): SecurityIr;
//# sourceMappingURL=builder.d.ts.map