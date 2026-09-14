import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { releaseValidationReportSchema, type ReleaseValidationReport } from "./release.js";

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
] as const;

const alpha11SnapshotContract = {
  version: "0.6.0-alpha.11",
  tag: "v0.6.0-alpha.11",
  sourcePath: "validation/validation-report.json",
  snapshotPath: "validation/releases/v0.6.0-alpha.11/validation-report.json",
  sha256: "35ecd64fbd9c9d0a4bdff306afd058ee3e0c32cdb19dcb3dd3c051022a51b4bf",
} as const;

export const releaseHistorySchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    tags: z.array(historicalTagSchema),
    evidenceSnapshots: z.array(evidenceSnapshotSchema),
    failedReleaseAttempts: z.array(failedReleaseAttemptSchema),
  })
  .strict()
  .superRefine((history, context) => {
    const tagNames = new Set<string>();
    for (const tag of history.tags) {
      if (tagNames.has(tag.tag))
        context.addIssue({ code: "custom", message: `Duplicate historical tag ${tag.tag}.` });
      tagNames.add(tag.tag);
    }
    const snapshotPaths = new Set<string>();
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
    const alpha11Snapshot = history.evidenceSnapshots.find(
      (snapshot) => snapshot.version === alpha11SnapshotContract.version,
    );
    if (
      alpha11Snapshot === undefined ||
      Object.entries(alpha11SnapshotContract).some(
        ([key, value]) => alpha11Snapshot[key as keyof typeof alpha11Snapshot] !== value,
      )
    )
      context.addIssue({
        code: "custom",
        message: "Immutable alpha.11 evidence snapshot contract changed.",
      });
    const alpha12Failure = history.failedReleaseAttempts.find(
      (attempt) => attempt.tag === "v0.6.0-alpha.12",
    );
    if (alpha12Failure?.releaseRun !== 34821381636)
      context.addIssue({
        code: "custom",
        message: "Immutable alpha.12 failed-release record changed.",
      });
  });

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
  issues: string[];
}

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
] as const;

export function versionedReleaseReportPath(version: string): string {
  const parsedVersion = releaseVersionSchema.parse(version);
  return `validation/releases/v${parsedVersion}/validation-report.json`;
}

export async function readVersionedReleaseReport(root: string, version: string): Promise<unknown> {
  const reportPath = versionedReleaseReportPath(version);
  try {
    return JSON.parse(await readFile(path.resolve(root, reportPath), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new Error(`Current release report is missing: ${reportPath}.`, { cause: error });
    throw new Error(`Current release report is malformed: ${reportPath}.`, { cause: error });
  }
}

export function assessReleaseTagIntegrity(
  historyInput: unknown,
  observedTags: ObservedReleaseTag[],
  context: ReleaseTagContext,
): ReleaseTagIntegrityResult {
  const history = releaseHistorySchema.parse(historyInput);
  const issues: string[] = [];
  const expectedByName = new Map(history.tags.map((tag) => [tag.tag, tag]));
  const observedByName = new Map<string, ObservedReleaseTag>();
  for (const tag of observedTags) {
    if (observedByName.has(tag.tag)) issues.push(`Duplicate observed tag ${tag.tag}.`);
    observedByName.set(tag.tag, tag);
  }

  let historicalTagsVerified = 0;
  for (const expected of history.tags) {
    const observed = observedByName.get(expected.tag);
    if (observed === undefined) {
      issues.push(`Required historical tag ${expected.tag} is missing.`);
      continue;
    }
    if (observed.type !== "tag") issues.push(`Historical tag ${expected.tag} is not annotated.`);
    if (observed.object !== expected.object)
      issues.push(`Historical tag ${expected.tag} object identity changed.`);
    if (observed.target !== expected.target)
      issues.push(`Historical tag ${expected.tag} target changed.`);
    if (
      observed.type === "tag" &&
      observed.object === expected.object &&
      observed.target === expected.target
    )
      historicalTagsVerified += 1;
  }

  const currentTag = `v${context.currentVersion}`;
  if (context.expectedCurrentTag !== undefined && context.expectedCurrentTag !== currentTag)
    issues.push(
      `Release context tag ${context.expectedCurrentTag} does not match current version ${currentTag}.`,
    );

  for (const observed of observedTags) {
    if (expectedByName.has(observed.tag)) continue;
    if (observed.tag !== currentTag || context.expectedCurrentTag !== currentTag) {
      issues.push(`Unexpected release tag ${observed.tag}.`);
      continue;
    }
    if (observed.type !== "tag") issues.push(`Current release tag ${currentTag} is not annotated.`);
    if (observed.target !== context.currentHead)
      issues.push(`Current release tag ${currentTag} does not target HEAD.`);
  }

  const observedCurrent = observedByName.get(currentTag);
  if (context.expectedCurrentTag === currentTag) {
    if (expectedByName.has(currentTag))
      issues.push(`Current release tag ${currentTag} is already immutable historical identity.`);
    else if (observedCurrent === undefined)
      issues.push(`Current release tag ${currentTag} is missing from release context.`);
  } else if (observedCurrent !== undefined && !expectedByName.has(currentTag)) {
    issues.push(
      `Conflicting current-version tag ${currentTag} exists outside a tag release context.`,
    );
  }

  return {
    state: issues.length === 0 ? "PASS" : "FAIL",
    historicalTagsVerified,
    currentTag: context.expectedCurrentTag ?? null,
    issues,
  };
}

export function verifyHistoricalEvidenceSnapshot(
  snapshot: ReleaseHistory["evidenceSnapshots"][number],
  storedBytes: Uint8Array,
  taggedBytes: Uint8Array,
): ReleaseValidationReport {
  const storedHash = createHash("sha256").update(storedBytes).digest("hex");
  const taggedHash = createHash("sha256").update(taggedBytes).digest("hex");
  if (storedHash !== snapshot.sha256 || taggedHash !== snapshot.sha256)
    throw new Error(`Historical release evidence digest changed: ${snapshot.snapshotPath}`);
  if (!Buffer.from(storedBytes).equals(Buffer.from(taggedBytes)))
    throw new Error(`Historical release evidence bytes changed: ${snapshot.snapshotPath}`);
  const report = releaseValidationReportSchema.parse(
    JSON.parse(Buffer.from(storedBytes).toString("utf8")),
  );
  if (report.product.version !== snapshot.version)
    throw new Error(`Historical release evidence version changed: ${snapshot.snapshotPath}`);
  return report;
}

export interface ReleaseReportSourceIdentity {
  head: string;
  parent: string | null;
  changedFromParent: string[];
  reportTrackedClean: boolean;
}

export function validateCurrentReleaseReport(
  reportInput: unknown,
  packageIdentity: { name: string; version: string },
  sourceIdentity: ReleaseReportSourceIdentity,
): ReleaseValidationReport {
  const parsed = releaseValidationReportSchema.safeParse(reportInput);
  if (!parsed.success) throw new Error("Current release report is malformed.");
  const report = parsed.data;
  if (report.product.name !== packageIdentity.name)
    throw new Error(`Release evidence product ${report.product.name} does not match package.`);
  if (report.product.version !== packageIdentity.version)
    throw new Error(`Release evidence version ${report.product.version} does not match package.`);
  if (
    report.product.evidenceOrigin !== "PUBLIC_GIT_COMMIT" ||
    report.product.publicSourceCommit === undefined
  )
    throw new Error("Current release evidence must identify a public source commit.");

  const reportPath = versionedReleaseReportPath(packageIdentity.version);
  const sourceCommit = report.product.publicSourceCommit;
  const generatedAgainstCurrentHead =
    sourceCommit === sourceIdentity.head && !sourceIdentity.reportTrackedClean;
  const committedImmediatelyAfterSource =
    sourceCommit === sourceIdentity.parent &&
    sourceIdentity.changedFromParent.length === 1 &&
    sourceIdentity.changedFromParent[0] === reportPath;
  if (!generatedAgainstCurrentHead && !committedImmediatelyAfterSource)
    throw new Error("Current release report has a stale or contradictory source identity.");

  const checksById = new Map<string, ReleaseValidationReport["checks"][number]>();
  for (const check of report.checks) {
    if (checksById.has(check.id)) throw new Error(`Duplicate release check ${check.id}.`);
    checksById.set(check.id, check);
  }
  const completeTests = checksById.get("complete-test-suite");
  if (completeTests !== undefined) {
    const expectedState =
      report.tests.filesFailed > 0 || report.tests.testsFailed > 0
        ? "executed_fail"
        : report.tests.filesSkipped > 0 || report.tests.testsSkipped > 0
          ? "skipped_capability"
          : "executed_pass";
    if (completeTests.state !== expectedState)
      throw new Error("Complete-test-suite check contradicts the recorded test totals.");
  }
  if (report.verdict !== "NOT_READY_FOR_PUBLIC_USE") {
    const blockers = mandatoryReleaseCheckIds.filter(
      (id) => checksById.get(id)?.state !== "executed_pass",
    );
    if (blockers.length > 0)
      throw new Error(
        `Ready release verdict contradicts mandatory checks: ${blockers.join(", ")}.`,
      );
  }
  return report;
}
