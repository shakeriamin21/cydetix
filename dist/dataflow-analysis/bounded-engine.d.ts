import type { ParsedSource } from "../ast-analysis/parser.js";
import type { FindingProof, RemediationReasonCode } from "../core/schema.js";
import type { SourceFile } from "../repository-discovery/traverse.js";
import type { SecurityIr } from "../security-ir/model.js";
import { type ApplicationDataflowAnalysis, type ApplicationDataflowKind } from "./model.js";
export interface DataflowCandidate {
    readonly kind: ApplicationDataflowKind;
    readonly file: SourceFile;
    readonly startOffset: number;
    readonly endOffset: number;
    readonly message: string;
    readonly affectedComponent: string;
    readonly proof: Omit<FindingProof, "ruleId" | "ruleVersion" | "ruleMaturity" | "cwe" | "asvs" | "owaspTop10">;
    readonly remediationReasons: readonly RemediationReasonCode[];
    readonly fingerprintAnchor: string;
}
export interface DataflowBuildResult {
    readonly analysis: ApplicationDataflowAnalysis;
    readonly candidates: readonly DataflowCandidate[];
}
export declare function analyzeApplicationDataflow(files: readonly SourceFile[], parsedByPath: ReadonlyMap<string, ParsedSource>, securityIr?: SecurityIr): DataflowBuildResult;
export declare const DATAFLOW_RESOURCE_BOUNDS: {
    readonly maxAstNodesPerFile: 50000;
    readonly maxRepositoryAstNodes: 200000;
    readonly maxFacts: 10000;
    readonly maxIterations: 8;
    readonly maxEvidenceSteps: 16;
};
//# sourceMappingURL=bounded-engine.d.ts.map