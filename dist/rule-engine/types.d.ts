import type { AuthorizationProof } from "../authorization-analysis/model.js";
import type { AuthenticationAnalysis } from "../authentication-analysis/model.js";
import type { Finding, RuleDefinition } from "../core/schema.js";
import type { ParsedSource } from "../ast-analysis/parser.js";
import type { SourceFile } from "../repository-discovery/traverse.js";
import type { SecurityIr } from "../security-ir/model.js";
export interface AnalysisContext {
    readonly file: SourceFile;
    readonly parsed: ParsedSource | undefined;
}
export interface SecurityRule {
    readonly definition: RuleDefinition;
    analyze(context: AnalysisContext): readonly Finding[];
}
export interface RepositoryAnalysisContext {
    readonly files: readonly SourceFile[];
    readonly securityIr: SecurityIr;
    readonly authorizationProofs: readonly AuthorizationProof[];
    readonly authenticationAnalysis?: AuthenticationAnalysis;
}
export interface RepositorySecurityRule {
    readonly definition: RuleDefinition;
    analyze(context: RepositoryAnalysisContext): readonly Finding[];
}
//# sourceMappingURL=types.d.ts.map