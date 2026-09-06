import type { AuthorizationProof } from "../authorization-analysis/model.js";
import type { AuthenticationAnalysis } from "../authentication-analysis/model.js";
import type { AuthGraph, RepositoryManifest } from "../core/schema.js";
import type { SourceFile } from "../repository-discovery/traverse.js";
import type { SecurityIr } from "../security-ir/model.js";
export declare function buildAuthenticationGraph(manifest: RepositoryManifest, files: readonly SourceFile[], securityIr?: SecurityIr, authorizationProofs?: readonly AuthorizationProof[], authenticationAnalysis?: AuthenticationAnalysis): AuthGraph;
//# sourceMappingURL=model.d.ts.map