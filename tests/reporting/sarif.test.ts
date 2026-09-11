import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { scanRepository } from "../../src/core/engine.js";
import { toSarif } from "../../src/reporting/sarif.js";
import { renderText } from "../../src/reporting/text.js";

describe("SARIF reporting", () => {
  it("emits SARIF 2.1.0 with rule metadata, relative paths, and fingerprints", async () => {
    const report = await scanRepository({
      path: path.resolve("fixtures", "typescript", "vulnerable"),
    });
    const sarif = toSarif(report) as unknown as {
      version: string;
      runs: Array<{
        tool: { driver: { rules: unknown[] } };
        results: Array<{
          ruleId: string;
          partialFingerprints: Record<string, string>;
          locations: Array<{ physicalLocation: { artifactLocation: { uri: string } } }>;
          fixes?: Array<{
            artifactChanges: Array<{
              artifactLocation: { uri: string };
              replacements: Array<{ insertedContent: { text: string } }>;
            }>;
          }>;
        }>;
      }>;
    };
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0]?.tool.driver.rules).toHaveLength(24);
    expect(sarif.runs[0]?.results.length).toBeGreaterThan(0);
    for (const result of sarif.runs[0]?.results ?? []) {
      expect(result.partialFingerprints["cydetix/v1"]).toMatch(/^[a-f0-9]{64}$/);
      expect(
        path.isAbsolute(result.locations[0]?.physicalLocation.artifactLocation.uri ?? ""),
      ).toBe(false);
    }
    const safeFix = sarif.runs[0]?.results.find((result) => result.fixes !== undefined);
    expect(safeFix?.ruleId).toBe("AS-SESSION-001");
    expect(safeFix?.fixes?.[0]?.artifactChanges[0]?.replacements[0]?.insertedContent.text).toBe(
      "true",
    );
  });

  it("matches the normalized JSON and SARIF golden fixtures", async () => {
    const report = await scanRepository({
      path: path.resolve("fixtures", "typescript", "vulnerable"),
    });
    const reportProjection = {
      schemaVersion: report.schemaVersion,
      filesExamined: report.manifest.filesExamined,
      languages: report.manifest.languages,
      frameworks: report.manifest.frameworks,
      ruleIds: report.findings.map((finding) => finding.ruleId),
      summary: report.summary,
    };
    const expectedReport: unknown = JSON.parse(
      await readFile(
        path.resolve("fixtures", "golden", "typescript-vulnerable-summary.json"),
        "utf8",
      ),
    );
    expect(reportProjection).toEqual(expectedReport);

    const sarif = toSarif(report) as unknown as {
      version: string;
      runs: Array<{
        tool: { driver: { rules: unknown[] } };
        results: Array<{
          ruleId: string;
          level: string;
          locations: Array<{ physicalLocation: { artifactLocation: { uriBaseId: string } } }>;
        }>;
      }>;
    };
    const run = sarif.runs[0];
    const sarifProjection = {
      version: sarif.version,
      ruleCount: run?.tool.driver.rules.length ?? 0,
      resultRuleIds: run?.results.map((result) => result.ruleId) ?? [],
      levels: run?.results.map((result) => result.level) ?? [],
      uriBaseId: run?.results[0]?.locations[0]?.physicalLocation.artifactLocation.uriBaseId,
    };
    const expectedSarif: unknown = JSON.parse(
      await readFile(
        path.resolve("fixtures", "golden", "typescript-vulnerable-sarif.json"),
        "utf8",
      ),
    );
    expect(sarifProjection).toEqual(expectedSarif);
  });

  it("neutralizes terminal control characters in untrusted report fields", async () => {
    const report = await scanRepository({
      path: path.resolve("fixtures", "typescript", "vulnerable"),
    });
    const finding = report.findings[0];
    if (finding === undefined) throw new Error("Expected fixture finding.");
    finding.location.path = "malicious\u001b[31m.ts";
    finding.evidence[0] = {
      message: "line one\nline two",
      excerpt: "ignored",
      redacted: false,
    };
    const output = renderText(report);
    expect(output).not.toContain("\u001b");
    expect(output).toContain("malicious\\u001b[31m.ts");
    expect(output).toContain("line one\\u000aline two");
  });
});
