import { z } from "zod";
import { type ReleaseValidationReport } from "./release.js";
declare const historicalTagSchema: z.ZodObject<{
    tag: z.ZodString;
    object: z.ZodString;
    target: z.ZodString;
}, z.core.$strict>;
export declare const immutableHistoricalReleaseIdentities: readonly [{
    readonly tag: "v0.6.0-alpha.11";
    readonly object: "e692f1e23d58157a209f511adb6180d3f489a80c";
    readonly target: "4e13b96cc3539e1b623a4c5a12f10a0954776253";
}, {
    readonly tag: "v0.6.0-alpha.12";
    readonly object: "c03f2a1e72af312266f68d66ac4183e0c00511bd";
    readonly target: "5bf295f53f4ca912a79715fd1ea455a31b72a585";
}, {
    readonly tag: "v0.6.0-beta.1";
    readonly object: "4aecf7055d2184d18e1dc5da63dd3a6e65e0259d";
    readonly target: "9ecc68f54127e5951d7c2a829cdd719b35779809";
}, {
    readonly tag: "v0.6.0-beta.2";
    readonly object: "a76d297b9749aff247ce980310441d1b058f1644";
    readonly target: "e4dbda8b15620e99827b056b92b51ce68a4c60e8";
}];
export declare const releaseHistorySchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"1.0.0">;
    tags: z.ZodArray<z.ZodObject<{
        tag: z.ZodString;
        object: z.ZodString;
        target: z.ZodString;
    }, z.core.$strict>>;
    evidenceSnapshots: z.ZodArray<z.ZodObject<{
        version: z.ZodString;
        tag: z.ZodString;
        sourcePath: z.ZodString;
        snapshotPath: z.ZodString;
        sha256: z.ZodString;
    }, z.core.$strict>>;
    failedReleaseAttempts: z.ZodArray<z.ZodObject<{
        tag: z.ZodString;
        releaseRun: z.ZodNumber;
        state: z.ZodLiteral<"FAILED_BEFORE_PUBLICATION">;
        npmPublished: z.ZodLiteral<false>;
        publicGitHubReleaseCreated: z.ZodLiteral<false>;
        failure: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type ReleaseHistory = z.infer<typeof releaseHistorySchema>;
export type HistoricalTag = z.infer<typeof historicalTagSchema>;
export interface ObservedReleaseTag {
    tag: string;
    type: string;
    object: string;
    target: string;
}
export interface ReleaseTagContext {
    currentVersion: string;
    currentHead: string;
    expectedCurrentTag?: string;
}
export interface ReleaseTagIntegrityResult {
    state: "PASS" | "FAIL";
    historicalTagsVerified: number;
    currentTag: string | null;
    currentEvidenceCommit: string | null;
    issues: string[];
}
export declare const mandatoryReleaseCheckIds: readonly ["source-state", "git-history-privacy", "complete-test-suite", "container-capability", "previously-gated-five", "network-denial", "environment-and-host-filesystem-isolation", "container-privilege-controls", "resource-and-timeout-enforcement", "ephemeral-workspace-cleanup", "ordinary-scan-hostile-repository", "no-silent-local-fallback", "authorized-command-entrypoint-integrity", "sandboxed-remediation-end-to-end", "sandboxed-verification-rollback", "sandbox-output-redaction-and-terminal-safety", "stored-external-results-integrity", "self-scan", "packed-install-current-host", "packed-plugin", "release-artifacts", "clean-public-lineage"];
export declare function versionedReleaseReportPath(version: string): string;
export declare function readVersionedReleaseReport(root: string, version: string): Promise<unknown>;
export declare function assessReleaseTagIntegrity(historyInput: unknown, observedTags: ObservedReleaseTag[], context: ReleaseTagContext): ReleaseTagIntegrityResult;
export declare function verifyHistoricalEvidenceSnapshot(snapshot: ReleaseHistory["evidenceSnapshots"][number], storedBytes: Uint8Array, taggedBytes: Uint8Array): ReleaseValidationReport;
export interface ReleaseReportSourceIdentity {
    head: string;
    parents: string[];
    changedFromParent: string[];
    reportTrackedClean: boolean;
}
export declare function releaseEvidenceOnlyPaths(version: string): readonly string[];
export declare function validateCurrentReleaseReport(reportInput: unknown, packageIdentity: {
    name: string;
    version: string;
}, sourceIdentity: ReleaseReportSourceIdentity, options?: {
    requireReleaseReady?: boolean;
}): ReleaseValidationReport;
export {};
//# sourceMappingURL=release-evidence.d.ts.map