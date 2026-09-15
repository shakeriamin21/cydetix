import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assessReleaseTagIntegrity,
  readVersionedReleaseReport,
  releaseEvidenceOnlyPaths,
  releaseHistorySchema,
  validateCurrentReleaseReport,
  verifyHistoricalEvidenceSnapshot,
  versionedReleaseReportPath,
} from "../../src/validation/release-evidence.js";
import {
  releaseValidationReportSchema,
  type ReleaseValidationReport,
} from "../../src/validation/release.js";

const history = releaseHistorySchema.parse(
  JSON.parse(readFileSync("validation/releases/release-history.json", "utf8")),
);

const observedHistoricalTags = history.tags.map((tag) => ({
  tag: tag.tag,
  type: "tag",
  object: tag.object,
  target: tag.target,
}));

const sourceCommit = "a".repeat(40);
const evidenceCommit = "b".repeat(40);
const grandparentCommit = "c".repeat(40);
const unrelatedCommit = "d".repeat(40);
const betaReportPath = versionedReleaseReportPath("0.6.0-beta.1");

function currentReportFixture(): ReleaseValidationReport {
  const report = releaseValidationReportSchema.parse(
    JSON.parse(
      readFileSync("validation/releases/v0.6.0-alpha.11/validation-report.json", "utf8"),
    ) as unknown,
  );
  report.product.version = "0.6.0-beta.1";
  report.product.publicSourceCommit = sourceCommit;
  return report;
}

describe("versioned release evidence", () => {
  it("accepts multiple legitimate immutable historical tags", () => {
    const result = assessReleaseTagIntegrity(history, observedHistoricalTags, {
      currentVersion: "0.6.0-beta.2",
      currentHead: "b".repeat(40),
    });
    expect(result).toMatchObject({
      state: "PASS",
      historicalTagsVerified: history.tags.length,
      currentTag: null,
      currentEvidenceCommit: null,
      issues: [],
    });
  });

  it("derives the evidence commit from an annotated current release tag", () => {
    const result = assessReleaseTagIntegrity(
      history,
      [
        ...observedHistoricalTags,
        {
          tag: "v0.6.0-beta.2",
          type: "tag",
          object: grandparentCommit,
          target: evidenceCommit,
        },
      ],
      {
        currentVersion: "0.6.0-beta.2",
        currentHead: evidenceCommit,
        expectedCurrentTag: "v0.6.0-beta.2",
      },
    );
    expect(result.state).toBe("PASS");
    expect(result.currentTag).toBe("v0.6.0-beta.2");
    expect(result.currentEvidenceCommit).toBe(evidenceCommit);
  });

  it("rejects a changed historical tag target", () => {
    const observed = structuredClone(observedHistoricalTags);
    const alpha11 = observed.find((tag) => tag.tag === "v0.6.0-alpha.11");
    if (alpha11 === undefined) throw new Error("Alpha.11 fixture is missing.");
    alpha11.target = "d".repeat(40);
    const result = assessReleaseTagIntegrity(history, observed, {
      currentVersion: "0.6.0-beta.2",
      currentHead: "b".repeat(40),
    });
    expect(result.state).toBe("FAIL");
    expect(result.issues).toContain("Historical tag v0.6.0-alpha.11 target changed.");
  });

  it("rejects changes to protected historical identities in the registry", () => {
    const changedHistory = structuredClone(history);
    const beta1 = changedHistory.tags.find((tag) => tag.tag === "v0.6.0-beta.1");
    if (beta1 === undefined) throw new Error("Beta.1 fixture is missing.");
    beta1.target = "d".repeat(40);
    expect(() => releaseHistorySchema.parse(changedHistory)).toThrow(
      "Immutable historical identity changed: v0.6.0-beta.1",
    );
  });

  it("rejects missing and altered historical tag identities", () => {
    const observed = structuredClone(observedHistoricalTags).filter(
      (tag) => tag.tag !== "v0.6.0-alpha.10",
    );
    const alpha11 = observed.find((tag) => tag.tag === "v0.6.0-alpha.11");
    if (alpha11 === undefined) throw new Error("Alpha.11 fixture is missing.");
    alpha11.object = "e".repeat(40);
    const result = assessReleaseTagIntegrity(history, observed, {
      currentVersion: "0.6.0-beta.2",
      currentHead: "b".repeat(40),
    });
    expect(result.state).toBe("FAIL");
    expect(result.issues).toContain("Required historical tag v0.6.0-alpha.10 is missing.");
    expect(result.issues).toContain("Historical tag v0.6.0-alpha.11 object identity changed.");
  });

  it("rejects a conflicting current-version tag outside release context", () => {
    const result = assessReleaseTagIntegrity(
      history,
      [
        ...observedHistoricalTags,
        {
          tag: "v0.6.0-beta.2",
          type: "tag",
          object: "c".repeat(40),
          target: "b".repeat(40),
        },
      ],
      { currentVersion: "0.6.0-beta.2", currentHead: "b".repeat(40) },
    );
    expect(result.state).toBe("FAIL");
    expect(result.issues).toContain(
      "Conflicting current-version tag v0.6.0-beta.2 exists outside a tag release context.",
    );
  });

  it("rejects an unexpected unrecorded historical release tag", () => {
    const result = assessReleaseTagIntegrity(
      history,
      [
        ...observedHistoricalTags,
        {
          tag: "v0.5.0",
          type: "tag",
          object: "c".repeat(40),
          target: "b".repeat(40),
        },
      ],
      { currentVersion: "0.6.0-beta.2", currentHead: "b".repeat(40) },
    );
    expect(result.state).toBe("FAIL");
    expect(result.issues).toContain("Unexpected release tag v0.5.0.");
  });

  it("rejects a lightweight current release tag", () => {
    const result = assessReleaseTagIntegrity(
      history,
      [
        ...observedHistoricalTags,
        {
          tag: "v0.6.0-beta.2",
          type: "commit",
          object: "c".repeat(40),
          target: evidenceCommit,
        },
      ],
      {
        currentVersion: "0.6.0-beta.2",
        currentHead: evidenceCommit,
        expectedCurrentTag: "v0.6.0-beta.2",
      },
    );
    expect(result.state).toBe("FAIL");
    expect(result.issues).toContain("Current release tag v0.6.0-beta.2 is not annotated.");
  });

  it.each([
    ["source commit", sourceCommit],
    ["an unrelated commit", unrelatedCommit],
  ])("rejects an annotated tag targeting the %s instead of E", (_label, target) => {
    const result = assessReleaseTagIntegrity(
      history,
      [
        ...observedHistoricalTags,
        {
          tag: "v0.6.0-beta.2",
          type: "tag",
          object: grandparentCommit,
          target,
        },
      ],
      {
        currentVersion: "0.6.0-beta.2",
        currentHead: evidenceCommit,
        expectedCurrentTag: "v0.6.0-beta.2",
      },
    );
    expect(result.state).toBe("FAIL");
    expect(result.issues).toContain("Current release tag v0.6.0-beta.2 does not target HEAD.");
  });

  it("verifies the Alpha.11 snapshot bytes and digest", async () => {
    const snapshot = history.evidenceSnapshots[0];
    if (snapshot === undefined) throw new Error("Historical snapshot fixture is missing.");
    const stored = await readFile(snapshot.snapshotPath);
    const report = verifyHistoricalEvidenceSnapshot(snapshot, stored, stored);
    expect(report.product.version).toBe("0.6.0-alpha.11");
    expect(() =>
      verifyHistoricalEvidenceSnapshot(snapshot, Buffer.concat([stored, Buffer.from(" ")]), stored),
    ).toThrow("Historical release evidence digest changed");
  });

  it("preserves the immutable Beta.1 validation snapshot", async () => {
    const snapshot = history.evidenceSnapshots.find((entry) => entry.version === "0.6.0-beta.1");
    if (snapshot === undefined) throw new Error("Beta.1 snapshot fixture is missing.");
    const stored = await readFile(snapshot.snapshotPath);
    const report = verifyHistoricalEvidenceSnapshot(snapshot, stored, stored);
    expect(report.product.version).toBe("0.6.0-beta.1");
  });

  it("resolves and validates the report belonging to the package version", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "cydetix-release-report-"));
    try {
      const relative = versionedReleaseReportPath("0.6.0-beta.1");
      await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
      await writeFile(path.join(root, relative), `${JSON.stringify(currentReportFixture())}\n`);
      const input = await readVersionedReleaseReport(root, "0.6.0-beta.1");
      const report = validateCurrentReleaseReport(
        input,
        { name: "cydetix", version: "0.6.0-beta.1" },
        {
          head: sourceCommit,
          parents: [],
          changedFromParent: [],
          reportTrackedClean: false,
        },
      );
      expect(report.product.version).toBe("0.6.0-beta.1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("accepts a committed report at E that identifies direct parent S", () => {
    const report = currentReportFixture();
    const validated = validateCurrentReleaseReport(
      report,
      { name: "cydetix", version: "0.6.0-beta.1" },
      {
        head: evidenceCommit,
        parents: [sourceCommit],
        changedFromParent: [betaReportPath],
        reportTrackedClean: true,
      },
    );
    expect(validated.product.publicSourceCommit).toBe(sourceCommit);
    expect(releaseEvidenceOnlyPaths("0.6.0-beta.1")).toEqual([betaReportPath]);
  });

  it("fails closed for missing and malformed versioned reports", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "cydetix-release-report-"));
    try {
      await expect(readVersionedReleaseReport(root, "0.6.0-beta.1")).rejects.toThrow(
        "Current release report is missing",
      );
      const relative = versionedReleaseReportPath("0.6.0-beta.1");
      await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
      await writeFile(path.join(root, relative), "not json\n");
      await expect(readVersionedReleaseReport(root, "0.6.0-beta.1")).rejects.toThrow(
        "Current release report is malformed",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects wrong product, wrong version and stale source identity", () => {
    const report = currentReportFixture();
    expect(() =>
      validateCurrentReleaseReport(
        { ...report, product: { ...report.product, name: "other" } },
        { name: "cydetix", version: "0.6.0-beta.1" },
        {
          head: sourceCommit,
          parents: [],
          changedFromParent: [],
          reportTrackedClean: false,
        },
      ),
    ).toThrow();
    expect(() =>
      validateCurrentReleaseReport(
        { ...report, product: { ...report.product, version: "0.6.0-beta.2" } },
        { name: "cydetix", version: "0.6.0-beta.1" },
        {
          head: sourceCommit,
          parents: [],
          changedFromParent: [],
          reportTrackedClean: false,
        },
      ),
    ).toThrow("does not match package");
    expect(() =>
      validateCurrentReleaseReport(
        report,
        { name: "cydetix", version: "0.6.0-beta.1" },
        {
          head: evidenceCommit,
          parents: [grandparentCommit],
          changedFromParent: [betaReportPath],
          reportTrackedClean: true,
        },
      ),
    ).toThrow("direct parent");
  });

  it.each([
    ["an unrelated commit", unrelatedCommit],
    ["the grandparent", grandparentCommit],
    ["the evidence commit itself", evidenceCommit],
  ])("rejects publicSourceCommit identifying %s instead of direct parent S", (_label, commit) => {
    const report = currentReportFixture();
    report.product.publicSourceCommit = commit;
    expect(() =>
      validateCurrentReleaseReport(
        report,
        { name: "cydetix", version: "0.6.0-beta.1" },
        {
          head: evidenceCommit,
          parents: [sourceCommit],
          changedFromParent: [betaReportPath],
          reportTrackedClean: true,
        },
      ),
    ).toThrow("direct parent");
  });

  it("rejects an evidence merge commit", () => {
    expect(() =>
      validateCurrentReleaseReport(
        currentReportFixture(),
        { name: "cydetix", version: "0.6.0-beta.1" },
        {
          head: evidenceCommit,
          parents: [sourceCommit, unrelatedCommit],
          changedFromParent: [betaReportPath],
          reportTrackedClean: true,
        },
      ),
    ).toThrow("exactly one parent");
  });

  it("rejects adverse not-ready evidence in a trusted tag context", () => {
    const report = currentReportFixture();
    report.verdict = "NOT_READY_FOR_PUBLIC_USE";
    expect(() =>
      validateCurrentReleaseReport(
        report,
        { name: "cydetix", version: "0.6.0-beta.1" },
        {
          head: evidenceCommit,
          parents: [sourceCommit],
          changedFromParent: [betaReportPath],
          reportTrackedClean: true,
        },
        { requireReleaseReady: true },
      ),
    ).toThrow("not ready for public use");
  });

  it.each([
    ["runtime source", "src/cli/main.ts"],
    ["dependencies", "package-lock.json"],
    ["package version", "package.json"],
    ["workflow logic", ".github/workflows/release.yml"],
    ["security rules", "rules/AS-AUTHZ-001.yml"],
    ["proof semantics", "src/analysis/proof.ts"],
    ["remediation authority", "src/remediation/authority.ts"],
    ["generated runtime", "dist/cli/main.js"],
  ])("rejects %s changes in evidence commit E", (_label, changedPath) => {
    expect(() =>
      validateCurrentReleaseReport(
        currentReportFixture(),
        { name: "cydetix", version: "0.6.0-beta.1" },
        {
          head: evidenceCommit,
          parents: [sourceCommit],
          changedFromParent: [betaReportPath, changedPath],
          reportTrackedClean: true,
        },
      ),
    ).toThrow("may change only");
  });

  it("rejects a ready verdict contradicted by mandatory evidence", () => {
    const report = currentReportFixture();
    report.verdict = "PUBLIC_ALPHA_READY_WITH_LIMITATIONS";
    expect(() =>
      validateCurrentReleaseReport(
        report,
        { name: "cydetix", version: "0.6.0-beta.1" },
        {
          head: sourceCommit,
          parents: [],
          changedFromParent: [],
          reportTrackedClean: false,
        },
      ),
    ).toThrow("Ready release verdict contradicts mandatory checks");
  });
});
