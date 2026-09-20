import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  currentReleaseValidationReportSchema,
  legacyReleaseValidationReportSchema,
  releaseValidationReportSchema,
  releaseValidationVerdictForVersion,
} from "../../src/validation/release.js";

const historicalReport = JSON.parse(
  readFileSync("validation/releases/v1.0.1/validation-report.json", "utf8"),
) as Record<string, unknown>;

function currentReport(version: string, verdict: string): Record<string, unknown> {
  return {
    ...historicalReport,
    schemaVersion: "1.3.0",
    product: {
      ...(historicalReport.product as Record<string, unknown>),
      version,
    },
    verdict,
  };
}

describe("release validation maturity semantics", () => {
  it.each([
    ["1.0.2", "PUBLIC_STABLE_READY_WITH_LIMITATIONS"],
    ["1.1.0-alpha.1", "PUBLIC_ALPHA_READY_WITH_LIMITATIONS"],
    ["1.1.0-beta.1", "PUBLIC_BETA_READY_WITH_LIMITATIONS"],
  ])("maps %s to %s", (version, expected) => {
    expect(releaseValidationVerdictForVersion(version, true)).toBe(expected);
  });

  it.each(["1.0.2", "1.1.0-alpha.1", "1.1.0-beta.1"])(
    "represents failed or development evidence for %s as not ready",
    (version) => {
      expect(releaseValidationVerdictForVersion(version, false)).toBe("NOT_READY_FOR_PUBLIC_USE");
      expect(
        currentReleaseValidationReportSchema.safeParse(
          currentReport(version, "NOT_READY_FOR_PUBLIC_USE"),
        ).success,
      ).toBe(true);
    },
  );

  it.each(["1.0", "1.0.2-rc.1", "1.0.2-dev.1", "v1.0.2", "garbage"])(
    "fails closed for unsupported version %s",
    (version) => {
      expect(() => releaseValidationVerdictForVersion(version, true)).toThrow();
      expect(
        currentReleaseValidationReportSchema.safeParse(
          currentReport(version, "NOT_READY_FOR_PUBLIC_USE"),
        ).success,
      ).toBe(false);
    },
  );

  it.each([
    ["1.0.2", "PUBLIC_ALPHA_READY_WITH_LIMITATIONS"],
    ["1.1.0-alpha.1", "PUBLIC_STABLE_READY_WITH_LIMITATIONS"],
    ["1.1.0-beta.1", "PUBLIC_ALPHA_READY_WITH_LIMITATIONS"],
  ])("rejects contradictory %s / %s combinations", (version, verdict) => {
    expect(
      currentReleaseValidationReportSchema.safeParse(currentReport(version, verdict)).success,
    ).toBe(false);
  });

  it("preserves literal historical 1.2.0 reports without treating them as current", () => {
    expect(legacyReleaseValidationReportSchema.safeParse(historicalReport).success).toBe(true);
    expect(releaseValidationReportSchema.safeParse(historicalReport).success).toBe(true);
    expect(currentReleaseValidationReportSchema.safeParse(historicalReport).success).toBe(false);
  });
});
