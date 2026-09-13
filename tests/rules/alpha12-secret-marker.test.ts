import { describe, expect, it } from "vitest";
import { writeFile } from "node:fs/promises";
import { scanRepository } from "../../src/core/engine.js";
import { privateKeyMarkerFinding } from "../../src/rules/committed-secret.js";
import { temporaryDirectory } from "../helpers/temporary.js";

describe("private-key marker proof boundary", () => {
  it("retains placeholder markers as UNKNOWN without claiming leaked credential material", async () => {
    const root = await temporaryDirectory("cydetix-a12-marker-");
    const marker = ["-----BEGIN", "RSA PRIVATE KEY-----"].join(" ");
    await writeFile(`${root}/example.txt`, marker);
    const report = await scanRepository({ path: root });
    const finding = report.findings.find((f) => f.ruleId === "AS-SECRET-001");
    if (finding === undefined) throw new Error("Expected retained marker finding");
    expect(finding).toMatchObject({
      proofState: "UNKNOWN",
      analysisCompleteness: "PARTIAL",
      confidence: "high",
      reachability: "unknown",
      autofix: "ARCHITECTURAL",
      ruleVersion: "1.0.1",
    });
    expect(finding.title).toContain("material is unproven");
    expect(finding.remediation).toContain("marker alone");
    expect(finding.evidence.every((e) => e.redacted)).toBe(true);
    // The same conservative conversion is used for historical header matches.
    expect(
      privateKeyMarkerFinding({ ...finding, affectedComponent: "Git object history" }).proofState,
    ).toBe("UNKNOWN");
  });
});
