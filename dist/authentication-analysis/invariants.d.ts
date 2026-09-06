import type { ParsedSource } from "../ast-analysis/parser.js";
import type { RepositoryManifest } from "../core/schema.js";
import type { SourceFile } from "../repository-discovery/traverse.js";
import type { SecurityIr } from "../security-ir/model.js";
import { type AuthenticationAnalysis, type AuthenticationInvariant } from "./model.js";
export declare const AUTHENTICATION_INVARIANTS: readonly AuthenticationInvariant[];
export declare function buildAuthenticationAnalysis(ir: SecurityIr, manifest: RepositoryManifest, files: readonly SourceFile[], parsedByPath: ReadonlyMap<string, ParsedSource>): AuthenticationAnalysis;
//# sourceMappingURL=invariants.d.ts.map