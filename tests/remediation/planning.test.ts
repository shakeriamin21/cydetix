import path from "node:path";

import { describe, expect, it } from "vitest";

import { runRemediation } from "../../src/remediation/fix.js";
import type { AdvisoryProvider } from "../../src/supply-chain/advisories.js";

const affectedProvider: AdvisoryProvider = {
  name: "OSV-remediation-fixture",
  endpoint: "https://example.invalid/osv-remediation-fixture",
  query(packages) {
    return Promise.resolve(
      packages
        .filter((component) => component.name.endsWith("-vuln"))
        .map((component) => ({
          id: `OSV-PLAN-${component.name.toUpperCase()}`,
          aliases: [],
          packagePurl: component.purl,
          severity: "HIGH",
          fixedVersions: [component.name === "direct-vuln" ? "1.0.1" : "3.1.1"],
          references: ["https://example.invalid/advisory"],
          provider: "OSV-remediation-fixture",
        })),
    );
  },
};

describe("remediation classification planning", () => {
  it("keeps Action pinning REVIEW_REQUIRED and never invents a SHA", async () => {
    const report = await runRemediation({
      path: path.resolve("fixtures", "phase4", "actions-tagged"),
      applySafe: true,
      nonInteractive: true,
    });
    expect(report.plans).toHaveLength(1);
    expect(report.plans[0]).toMatchObject({
      ruleId: "AS-CI-001",
      classification: "REVIEW_REQUIRED",
      state: "REQUIRES_REVIEW",
    });
    expect(report.plans[0]?.transformations[0]?.description).toContain("no SHA was invented");
    expect(report.transactions).toEqual([]);
  });

  it("produces an architectural design with residual risk instead of inventing auth policy", async () => {
    const report = await runRemediation({
      path: path.resolve("fixtures", "phase3", "session-fixation"),
      dryRun: true,
    });
    const plan = report.plans.find((candidate) => candidate.ruleId === "AS-AUTH-SESSION-001");
    expect(plan).toMatchObject({
      classification: "ARCHITECTURAL",
      state: "REQUIRES_REVIEW",
      remediationSteps: ["ARCHITECTURE_CHANGE_REQUIRED"],
    });
    expect(plan?.residualRisk).not.toEqual([]);
    expect(report.transactions).toEqual([]);
  });

  it("models secret source removal as partial incident remediation", async () => {
    const report = await runRemediation({
      path: path.resolve("fixtures", "phase4", "secret-exposed"),
      dryRun: true,
    });
    const plan = report.plans.find((candidate) => candidate.ruleId === "AS-SECRET-001");
    expect(plan?.remediationSteps).toEqual(
      expect.arrayContaining([
        "SOURCE_REMOVAL",
        "ROTATION_REQUIRED",
        "REVOCATION_REQUIRED",
        "HISTORY_REVIEW_REQUIRED",
      ]),
    );
    expect(plan?.residualRisk[0]).toContain("does not revoke or rotate");
    expect(JSON.stringify(report)).not.toContain("7G9L2Q4M6R8T1V3X5Z7B9D2F4H6J8K");
  });

  it("uses exact advisory fixed-version evidence only for a review-required dependency plan", async () => {
    const report = await runRemediation({
      path: path.resolve("fixtures", "phase4", "dependencies-vulnerable"),
      advisories: "online",
      advisoryProvider: affectedProvider,
      applySafe: true,
    });
    expect(report.plans).toHaveLength(2);
    expect(report.plans.every((plan) => plan.classification === "REVIEW_REQUIRED")).toBe(true);
    expect(report.plans.every((plan) => plan.state === "REQUIRES_REVIEW")).toBe(true);
    expect(report.plans.map((plan) => plan.transformations[0]?.description).join("\n")).toContain(
      "fixed version(s)",
    );
    expect(report.plans.flatMap((plan) => plan.remediationSteps)).toContain(
      "LOCKFILE_RESOLUTION_REQUIRED",
    );
    expect(report.transactions).toEqual([]);
  });
});
