import path from "node:path";

import { describe, expect, it } from "vitest";

import { scanRepository } from "../../src/core/engine.js";
import { renderJson } from "../../src/reporting/json.js";

const fixture = (...parts: string[]): string => path.resolve("fixtures", ...parts);

describe("security fixtures", () => {
  it("detects every initial rule in the vulnerable TypeScript fixture", async () => {
    const report = await scanRepository({ path: fixture("typescript", "vulnerable") });
    expect(new Set(report.findings.map((finding) => finding.ruleId))).toEqual(
      new Set([
        "AS-SESSION-001",
        "AS-PASSWORD-001",
        "AS-TOKEN-001",
        "AS-SECRET-001",
        "AS-CORS-001",
      ]),
    );
    const output = renderJson(report);
    expect(output).not.toContain("fixture-only-not-a-real-secret-value-000000");
    expect(output).toContain("[REDACTED generic credential;");
  });

  it("does not flag the secure TypeScript fixture", async () => {
    const report = await scanRepository({ path: fixture("typescript", "secure") });
    expect(report.findings).toEqual([]);
  });

  it("detects every initial rule in the vulnerable Python fixture", async () => {
    const report = await scanRepository({ path: fixture("python", "vulnerable") });
    expect(new Set(report.findings.map((finding) => finding.ruleId))).toEqual(
      new Set([
        "AS-SESSION-001",
        "AS-PASSWORD-001",
        "AS-TOKEN-001",
        "AS-SECRET-001",
        "AS-CORS-001",
      ]),
    );
  });

  it("does not flag the secure Python fixture", async () => {
    const report = await scanRepository({ path: fixture("python", "secure") });
    expect(report.findings).toEqual([]);
  });
});
