import { describe, expect, it } from "vitest";

import { scanRepository } from "../../src/core/engine.js";
import { renderHuman } from "../../src/reporting/human.js";

describe("concise human report", () => {
  it("deduplicates repeated rule/location headlines without changing the report", async () => {
    const report = await scanRepository({
      path: "fixtures/typescript/vulnerable",
      now: new Date("2026-09-06T00:00:00.000Z"),
    });
    const matchingFindings = report.findings.filter(
      (finding) => finding.title === "Session cookie protection is explicitly disabled",
    );
    expect(matchingFindings.length).toBeGreaterThan(1);
    const output = renderHuman(report);
    expect(output).toContain("Security status: NEEDS ATTENTION");
    expect(output).toMatch(/FIX NOW\s+\d+/u);
    expect(output).toMatch(/REVIEW\s+\d+/u);
    expect(output).toMatch(/UNKNOWN\s+\d+/u);
    expect(output.match(/Session cookie protection is explicitly disabled/gu)).toHaveLength(1);
    expect(output).not.toContain("src/server.ts:");
    expect(report.findings).toHaveLength(6);
  });
});
