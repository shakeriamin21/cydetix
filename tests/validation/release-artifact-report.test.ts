import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  assessReleaseArtifactReport,
  type ReleaseReportSourceIdentity,
  versionedReleaseReportPath,
} from "../../src/validation/release-evidence.js";
import { currentReleaseValidationReportSchema } from "../../src/validation/release.js";

const s3 = "4939fadcb3c34eb6d065a98a731fd0748fcdc763";
const e2 = "582a81ebbcd7a086d5a286017bdd6efc6500bd26";
const s4 = "93ae9a469722f8ce8e30c84221b212887b9fbbfc";
const evidenceCommit = "e".repeat(40);
const packageIdentity = { name: "cydetix", version: "1.0.2" };
const reportPath = versionedReleaseReportPath(packageIdentity.version);
const historicalBytes = readFileSync(
  new URL("../fixtures/release-stale-s3-1.0.2.json", import.meta.url),
);
const historicalReport = currentReleaseValidationReportSchema.parse(
  JSON.parse(historicalBytes.toString("utf8")),
);

function candidateIdentity(head = s4): ReleaseReportSourceIdentity {
  return {
    head,
    parents: [e2],
    changedFromParent: ["package-lock.json"],
    reportTrackedClean: true,
  };
}

function evidenceIdentity(): ReleaseReportSourceIdentity {
  return {
    head: evidenceCommit,
    parents: [s4],
    changedFromParent: [reportPath],
    reportTrackedClean: true,
  };
}

function matchingReport() {
  const report = structuredClone(historicalReport);
  report.product.publicSourceCommit = s4;
  return report;
}

describe("release artifact report source binding", () => {
  it("rejects the real S4 candidate with the committed same-version S3 report", () => {
    expect(historicalReport.product.version).toBe("1.0.2");
    expect(historicalReport.product.publicSourceCommit).toBe(s3);
    expect(
      assessReleaseArtifactReport(historicalReport, packageIdentity, candidateIdentity()),
    ).toMatchObject({
      state: "STALE_SOURCE_REPORT",
      expectedSourceCommit: s4,
    });
  });

  it("does not treat a valid file checksum as current-source evidence", () => {
    const recordedHash = createHash("sha256").update(historicalBytes).digest("hex");
    expect(recordedHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(
      assessReleaseArtifactReport(
        JSON.parse(historicalBytes.toString("utf8")),
        packageIdentity,
        candidateIdentity(),
      ).state,
    ).toBe("STALE_SOURCE_REPORT");
  });

  it("accepts a matching report at an evidence-only commit", () => {
    expect(
      assessReleaseArtifactReport(matchingReport(), packageIdentity, evidenceIdentity()),
    ).toMatchObject({
      state: "CURRENT_VERSIONED_REPORT",
      expectedSourceCommit: s4,
    });
  });

  it("rejects a wrong version even when the source matches", () => {
    const report = matchingReport();
    report.product.version = "1.0.1";
    expect(() => assessReleaseArtifactReport(report, packageIdentity, evidenceIdentity())).toThrow(
      "does not match package",
    );
  });

  it("rejects a missing source binding", () => {
    const report = matchingReport();
    delete report.product.publicSourceCommit;
    expect(() => assessReleaseArtifactReport(report, packageIdentity, evidenceIdentity())).toThrow(
      "malformed",
    );
  });

  it("rejects a malformed source SHA", () => {
    const report = matchingReport();
    report.product.publicSourceCommit = "not-a-sha";
    expect(() => assessReleaseArtifactReport(report, packageIdentity, evidenceIdentity())).toThrow(
      "malformed",
    );
  });

  it("rejects a malformed report schema", () => {
    expect(() =>
      assessReleaseArtifactReport(
        { ...matchingReport(), schemaVersion: "0.0.0" },
        packageIdentity,
        evidenceIdentity(),
      ),
    ).toThrow("malformed");
  });

  it("rejects a matching report whose evidence-commit worktree is altered", () => {
    expect(() =>
      assessReleaseArtifactReport(matchingReport(), packageIdentity, {
        ...evidenceIdentity(),
        reportTrackedClean: false,
      }),
    ).toThrow("Uncommitted release report");
  });

  it("rejects a source candidate that committed its report alongside source changes", () => {
    expect(() =>
      assessReleaseArtifactReport(matchingReport(), packageIdentity, {
        ...candidateIdentity(),
        head: s4,
      }),
    ).toThrow("direct parent");
  });
});
