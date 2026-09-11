import type { SourceFile } from "../repository-discovery/traverse.js";
import { type SecretExposure } from "./model.js";
export interface SecretTextOptions {
    readonly path: string;
    readonly sourceCategory: SecretExposure["sourceCategory"];
    readonly historyState: SecretExposure["historyState"];
    readonly engine?: string;
    readonly lineOffset?: number;
}
export declare function detectSecretsInText(text: string, options: SecretTextOptions): SecretExposure[];
export declare function analyzeWorkingTreeSecrets(files: readonly SourceFile[]): {
    workingTree: "CHECKED_NO_FINDINGS" | "CHECKED_FINDINGS";
    history: "TRUNCATED" | "CHECKED" | "NOT_CHECKED" | "GIT_UNAVAILABLE" | "NOT_A_GIT_REPOSITORY" | "FAILED";
    exposures: {
        id: string;
        provider: string;
        type: string;
        location: {
            path: string;
            start: {
                line: number;
                column: number;
                offset: number;
            };
            end: {
                line: number;
                column: number;
                offset: number;
            };
        };
        redactedPreview: string;
        fingerprint: string;
        confidence: "low" | "medium" | "high";
        sourceCategory: "working-tree" | "git-history" | "external-tool";
        historyState: "current" | "historical" | "not-checked";
        rotationGuidance: ("CURRENT_TREE_REMOVAL" | "CREDENTIAL_ROTATION_REQUIRED" | "HISTORY_REWRITE_CONSIDER" | "PROVIDER_REVOCATION_REQUIRED")[];
        validationState: "PASSIVE_NOT_VALIDATED";
        engine: string;
    }[];
    redactionGuaranteed: true;
    activeValidation: "NOT_PERFORMED";
    limitations: string[];
};
//# sourceMappingURL=secrets.d.ts.map