import { describe, expect, it } from "vitest";

import { createRulesReport, createTrustReport } from "../../src/trust/model.js";

describe("trust inspection reports", () => {
  it("exposes stable normalized rule truth", () => {
    const first = createRulesReport();
    const second = createRulesReport();
    expect(first).toEqual(second);
    expect(first.rules).toHaveLength(24);
    expect(first.rules.map((rule) => rule.id)).toEqual(
      [...first.rules.map((rule) => rule.id)].sort(),
    );
    expect(first.rules.find((rule) => rule.id === "AS-SSRF-001")).toMatchObject({
      maturity: "PRODUCTION",
      maxRemediationClass: "REVIEW_REQUIRED",
      cwe: ["CWE-918"],
    });
  });

  it("reports actual engines, bounds, controls, SAFE adapters, and limitations", () => {
    const report = createTrustReport();
    expect(report.version).toBe("0.6.0-alpha.9");
    expect(report.maturityCounts.production).toBe(24);
    expect(report.safeRemediationAdapters).toHaveLength(1);
    expect(report.resourceBounds.maxIterations).toBe(8);
    expect(report.securityControls.some((control) => control.context === "SQL")).toBe(true);
    expect(report.unsupportedOrIncomplete).toContain("cross-file Batch 1 dataflow");
  });
});
