import type { SourceFile } from "../repository-discovery/traverse.js";
import { type SupplyChainEvidence, type WorkflowAnalysis } from "./model.js";
export interface WorkflowSignal {
    readonly kind: "untrusted-context-in-shell" | "dangerous-pull-request-target";
    readonly workflow: SourceFile;
    readonly message: string;
    readonly locations: readonly {
        offset: number;
        needle: string;
        message: string;
    }[];
}
export interface GithubActionsResult {
    readonly analysis: WorkflowAnalysis;
    readonly signals: readonly WorkflowSignal[];
    readonly evidence: readonly SupplyChainEvidence[];
}
export declare function analyzeGithubActions(files: readonly SourceFile[]): GithubActionsResult;
//# sourceMappingURL=github-actions.d.ts.map