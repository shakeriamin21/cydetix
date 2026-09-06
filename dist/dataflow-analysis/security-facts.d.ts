import type { ParsedSource } from "../ast-analysis/parser.js";
import type { SourceFile } from "../repository-discovery/traverse.js";
import { type SecurityIr } from "../security-ir/model.js";
export declare function enrichSecurityFacts(input: SecurityIr, files: readonly SourceFile[], parsedByPath: ReadonlyMap<string, ParsedSource>): SecurityIr;
//# sourceMappingURL=security-facts.d.ts.map