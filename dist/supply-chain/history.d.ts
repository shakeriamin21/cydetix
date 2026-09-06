import type { SecretExposure } from "./model.js";
export interface HistoryScanResult {
    readonly state: "CHECKED" | "GIT_UNAVAILABLE" | "NOT_A_GIT_REPOSITORY" | "TRUNCATED" | "FAILED";
    readonly exposures: readonly SecretExposure[];
    readonly message: string;
    readonly milliseconds: number;
}
export declare function scanGitHistory(root: string, maximumBytes?: number): HistoryScanResult;
//# sourceMappingURL=history.d.ts.map