import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { releaseValidationReportSchema } from "./release.js";
const gitObjectIdSchema = z.string().regex(/^[a-f0-9]{40}$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const releaseTagSchema = z.string().regex(/^v[0-9A-Za-z][0-9A-Za-z.+-]*$/);
const releaseVersionSchema = z.string().regex(/^[0-9A-Za-z][0-9A-Za-z.+-]*$/);
const repositoryPathSchema = z
    .string()
    .min(1)
    .refine((value) => !value.includes("\\") && !value.startsWith("/") && !value.includes(".."));
const historicalTagSchema = z
    .object({
    tag: releaseTagSchema,
    object: gitObjectIdSchema,
    target: gitObjectIdSchema,
})
    .strict();
const evidenceSnapshotSchema = z
    .object({
    version: releaseVersionSchema,
    tag: releaseTagSchema,
    sourcePath: repositoryPathSchema,
    snapshotPath: repositoryPathSchema,
    sha256: sha256Schema,
})
    .strict();
const failedReleaseAttemptSchema = z
    .object({
    tag: releaseTagSchema,
    releaseRun: z.number().int().positive(),
    state: z.literal("FAILED_BEFORE_PUBLICATION"),
    npmPublished: z.literal(false),
    publicGitHubReleaseCreated: z.literal(false),
    failure: z.string().min(1),
})
    .strict();
export const immutableHistoricalReleaseIdentities = [
    {
        tag: "v0.6.0-alpha.11",
        object: "e692f1e23d58157a209f511adb6180d3f489a80c",
        target: "4e13b96cc3539e1b623a4c5a12f10a0954776253",
    },
    {
        tag: "v0.6.0-alpha.12",
        object: "c03f2a1e72af312266f68d66ac4183e0c00511bd",
        target: "5bf295f53f4ca912a79715fd1ea455a31b72a585",
    },
    {
        tag: "v0.6.0-beta.1",
        object: "4aecf7055d2184d18e1dc5da63dd3a6e65e0259d",
        target: "9ecc68f54127e5951d7c2a829cdd719b35779809",
    },
];
const alpha11SnapshotContract = {
    version: "0.6.0-alpha.11",
    tag: "v0.6.0-alpha.11",
    sourcePath: "validation/validation-report.json",
    snapshotPath: "validation/releases/v0.6.0-alpha.11/validation-report.json",
    sha256: "35ecd64fbd9c9d0a4bdff306afd058ee3e0c32cdb19dcb3dd3c051022a51b4bf",
};
export const releaseHistorySchema = z
    .object({
    schemaVersion: z.literal("1.0.0"),
    tags: z.array(historicalTagSchema),
    evidenceSnapshots: z.array(evidenceSnapshotSchema),
    failedReleaseAttempts: z.array(failedReleaseAttemptSchema),
})
    .strict()
    .superRefine((history, context) => {
    const tagNames = new Set();
    for (const tag of history.tags) {
        if (tagNames.has(tag.tag))
            context.addIssue({ code: "custom", message: `Duplicate historical tag ${tag.tag}.` });
        tagNames.add(tag.tag);
    }
    const snapshotPaths = new Set();
    for (const snapshot of history.evidenceSnapshots) {
        if (!tagNames.has(snapshot.tag))
            context.addIssue({
                code: "custom",
                message: `Historical snapshot references unknown tag ${snapshot.tag}.`,
            });
        if (snapshotPaths.has(snapshot.snapshotPath))
            context.addIssue({
                code: "custom",
                message: `Duplicate historical snapshot ${snapshot.snapshotPath}.`,
            });
        snapshotPaths.add(snapshot.snapshotPath);
    }
    for (const attempt of history.failedReleaseAttempts)
        if (!tagNames.has(attempt.tag))
            context.addIssue({
                code: "custom",
                message: `Failed release attempt references unknown tag ${attempt.tag}.`,
            });
    for (const required of immutableHistoricalReleaseIdentities) {
        const recorded = history.tags.find((tag) => tag.tag === required.tag);
        if (recorded?.object !== required.object || recorded.target !== required.target)
            context.addIssue({
                code: "custom",
                message: `Immutable historical identity changed: ${required.tag}.`,
            });
    }
    const alpha11Snapshot = history.evidenceSnapshots.find((snapshot) => snapshot.version === alpha11SnapshotContract.version);
    if (alpha11Snapshot === undefined ||
        Object.entries(alpha11SnapshotContract).some(([key, value]) => alpha11Snapshot[key] !== value))
        context.addIssue({
            code: "custom",
            message: "Immutable alpha.11 evidence snapshot contract changed.",
        });
    const alpha12Failure = history.failedReleaseAttempts.find((attempt) => attempt.tag === "v0.6.0-alpha.12");
    if (alpha12Failure?.releaseRun !== 34821381636)
        context.addIssue({
            code: "custom",
            message: "Immutable alpha.12 failed-release record changed.",
        });
    const beta1Failure = history.failedReleaseAttempts.find((attempt) => attempt.tag === "v0.6.0-beta.1");
    if (beta1Failure?.releaseRun !== 34930694658)
        context.addIssue({
            code: "custom",
            message: "Immutable beta.1 failed-release record changed.",
        });
});
export const mandatoryReleaseCheckIds = [
    "source-state",
    "git-history-privacy",
    "complete-test-suite",
    "container-capability",
    "previously-gated-five",
    "network-denial",
    "environment-and-host-filesystem-isolation",
    "container-privilege-controls",
    "resource-and-timeout-enforcement",
    "ephemeral-workspace-cleanup",
    "ordinary-scan-hostile-repository",
    "no-silent-local-fallback",
    "authorized-command-entrypoint-integrity",
    "sandboxed-remediation-end-to-end",
    "sandboxed-verification-rollback",
    "sandbox-output-redaction-and-terminal-safety",
    "stored-external-results-integrity",
    "self-scan",
    "packed-install-current-host",
    "packed-plugin",
    "release-artifacts",
    "clean-public-lineage",
];
export function versionedReleaseReportPath(version) {
    const parsedVersion = releaseVersionSchema.parse(version);
    return `validation/releases/v${parsedVersion}/validation-report.json`;
}
export async function readVersionedReleaseReport(root, version) {
    const reportPath = versionedReleaseReportPath(version);
    try {
        return JSON.parse(await readFile(path.resolve(root, reportPath), "utf8"));
    }
    catch (error) {
        if (error.code === "ENOENT")
            throw new Error(`Current release report is missing: ${reportPath}.`, { cause: error });
        throw new Error(`Current release report is malformed: ${reportPath}.`, { cause: error });
    }
}
export function assessReleaseTagIntegrity(historyInput, observedTags, context) {
    const history = releaseHistorySchema.parse(historyInput);
    const issues = [];
    const expectedByName = new Map(history.tags.map((tag) => [tag.tag, tag]));
    const observedByName = new Map();
    for (const tag of observedTags) {
        if (observedByName.has(tag.tag))
            issues.push(`Duplicate observed tag ${tag.tag}.`);
        observedByName.set(tag.tag, tag);
    }
    let historicalTagsVerified = 0;
    for (const expected of history.tags) {
        const observed = observedByName.get(expected.tag);
        if (observed === undefined) {
            issues.push(`Required historical tag ${expected.tag} is missing.`);
            continue;
        }
        if (observed.type !== "tag")
            issues.push(`Historical tag ${expected.tag} is not annotated.`);
        if (observed.object !== expected.object)
            issues.push(`Historical tag ${expected.tag} object identity changed.`);
        if (observed.target !== expected.target)
            issues.push(`Historical tag ${expected.tag} target changed.`);
        if (observed.type === "tag" &&
            observed.object === expected.object &&
            observed.target === expected.target)
            historicalTagsVerified += 1;
    }
    const currentTag = `v${context.currentVersion}`;
    if (context.expectedCurrentTag !== undefined && context.expectedCurrentTag !== currentTag)
        issues.push(`Release context tag ${context.expectedCurrentTag} does not match current version ${currentTag}.`);
    for (const observed of observedTags) {
        if (expectedByName.has(observed.tag))
            continue;
        if (observed.tag !== currentTag || context.expectedCurrentTag !== currentTag) {
            issues.push(`Unexpected release tag ${observed.tag}.`);
            continue;
        }
        if (observed.type !== "tag")
            issues.push(`Current release tag ${currentTag} is not annotated.`);
        if (observed.target !== context.currentHead)
            issues.push(`Current release tag ${currentTag} does not target HEAD.`);
    }
    const observedCurrent = observedByName.get(currentTag);
    if (context.expectedCurrentTag === currentTag) {
        if (expectedByName.has(currentTag))
            issues.push(`Current release tag ${currentTag} is already immutable historical identity.`);
        else if (observedCurrent === undefined)
            issues.push(`Current release tag ${currentTag} is missing from release context.`);
    }
    else if (observedCurrent !== undefined && !expectedByName.has(currentTag)) {
        issues.push(`Conflicting current-version tag ${currentTag} exists outside a tag release context.`);
    }
    return {
        state: issues.length === 0 ? "PASS" : "FAIL",
        historicalTagsVerified,
        currentTag: context.expectedCurrentTag ?? null,
        currentEvidenceCommit: context.expectedCurrentTag === currentTag ? (observedCurrent?.target ?? null) : null,
        issues,
    };
}
export function verifyHistoricalEvidenceSnapshot(snapshot, storedBytes, taggedBytes) {
    const storedHash = createHash("sha256").update(storedBytes).digest("hex");
    const taggedHash = createHash("sha256").update(taggedBytes).digest("hex");
    if (storedHash !== snapshot.sha256 || taggedHash !== snapshot.sha256)
        throw new Error(`Historical release evidence digest changed: ${snapshot.snapshotPath}`);
    if (!Buffer.from(storedBytes).equals(Buffer.from(taggedBytes)))
        throw new Error(`Historical release evidence bytes changed: ${snapshot.snapshotPath}`);
    const report = releaseValidationReportSchema.parse(JSON.parse(Buffer.from(storedBytes).toString("utf8")));
    if (report.product.version !== snapshot.version)
        throw new Error(`Historical release evidence version changed: ${snapshot.snapshotPath}`);
    return report;
}
export function releaseEvidenceOnlyPaths(version) {
    return [versionedReleaseReportPath(version)];
}
function validateCommittedEvidenceIdentity(sourceCommit, packageVersion, sourceIdentity) {
    if (sourceIdentity.parents.length !== 1)
        throw new Error("Release evidence commit must have exactly one parent.");
    if (sourceCommit !== sourceIdentity.parents[0])
        throw new Error("Release report source commit must be the evidence commit's direct parent.");
    const allowedPaths = releaseEvidenceOnlyPaths(packageVersion);
    if (sourceIdentity.changedFromParent.length !== allowedPaths.length ||
        allowedPaths.some((allowedPath) => !sourceIdentity.changedFromParent.includes(allowedPath)))
        throw new Error(`Release evidence commit may change only: ${allowedPaths.join(", ")}.`);
}
export function validateCurrentReleaseReport(reportInput, packageIdentity, sourceIdentity, options = {}) {
    const parsed = releaseValidationReportSchema.safeParse(reportInput);
    if (!parsed.success)
        throw new Error("Current release report is malformed.");
    const report = parsed.data;
    if (report.product.name !== packageIdentity.name)
        throw new Error(`Release evidence product ${report.product.name} does not match package.`);
    if (report.product.version !== packageIdentity.version)
        throw new Error(`Release evidence version ${report.product.version} does not match package.`);
    if (report.product.evidenceOrigin !== "PUBLIC_GIT_COMMIT" ||
        report.product.publicSourceCommit === undefined)
        throw new Error("Current release evidence must identify a public source commit.");
    const sourceCommit = report.product.publicSourceCommit;
    const generatedAgainstCurrentHead = sourceCommit === sourceIdentity.head && !sourceIdentity.reportTrackedClean;
    if (sourceIdentity.reportTrackedClean)
        validateCommittedEvidenceIdentity(sourceCommit, packageIdentity.version, sourceIdentity);
    else if (!generatedAgainstCurrentHead)
        throw new Error("Uncommitted release report must identify the current source commit.");
    if (options.requireReleaseReady === true && report.verdict === "NOT_READY_FOR_PUBLIC_USE")
        throw new Error("Tagged release evidence is not ready for public use.");
    const checksById = new Map();
    for (const check of report.checks) {
        if (checksById.has(check.id))
            throw new Error(`Duplicate release check ${check.id}.`);
        checksById.set(check.id, check);
    }
    const completeTests = checksById.get("complete-test-suite");
    if (completeTests !== undefined) {
        const expectedState = report.tests.filesFailed > 0 || report.tests.testsFailed > 0
            ? "executed_fail"
            : report.tests.filesSkipped > 0 || report.tests.testsSkipped > 0
                ? "skipped_capability"
                : "executed_pass";
        if (completeTests.state !== expectedState)
            throw new Error("Complete-test-suite check contradicts the recorded test totals.");
    }
    if (report.verdict !== "NOT_READY_FOR_PUBLIC_USE") {
        const blockers = mandatoryReleaseCheckIds.filter((id) => checksById.get(id)?.state !== "executed_pass");
        if (blockers.length > 0)
            throw new Error(`Ready release verdict contradicts mandatory checks: ${blockers.join(", ")}.`);
    }
    return report;
}
//# sourceMappingURL=release-evidence.js.map