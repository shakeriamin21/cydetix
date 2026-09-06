import type { ParsedSource } from "../ast-analysis/parser.js";
import type { AuthenticationOperation } from "../authentication-analysis/model.js";
import type { RepositoryManifest } from "../core/schema.js";
import type { SourceFile } from "../repository-discovery/traverse.js";
import type { SecurityIr } from "../security-ir/model.js";
export declare function analyzeAuthenticationOperations(ir: SecurityIr, manifest: RepositoryManifest, files: readonly SourceFile[], parsedByPath: ReadonlyMap<string, ParsedSource>): AuthenticationOperation[];
//# sourceMappingURL=authentication.d.ts.map