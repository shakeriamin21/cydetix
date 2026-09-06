import { cp, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { scanRepository } from "../../src/core/engine.js";
import { temporaryDirectory } from "../helpers/temporary.js";

async function repositoryCopy(): Promise<string> {
  const temporary = await temporaryDirectory("cydetix-risk-");
  const target = path.join(temporary, "repo");
  await cp(path.resolve("fixtures", "typescript", "vulnerable"), target, { recursive: true });
  return target;
}

function config(expires: string): string {
  return `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      suppressions: [
        {
          rule: "AS-TOKEN-001",
          scope: ".",
          reason: "Synthetic accepted-risk test",
          owner: "test-owner",
          created: "2026-08-30",
          expires,
        },
      ],
    },
    null,
    2,
  )}\n`;
}

describe("accepted risk", () => {
  it("suppresses a scoped finding while retaining owner and expiry", async () => {
    const target = await repositoryCopy();
    await writeFile(path.join(target, ".cydetix.json"), config("2027-08-30"), "utf8");
    const report = await scanRepository({ path: target, now: new Date("2026-08-30T00:00:00Z") });
    expect(report.findings.some((finding) => finding.ruleId === "AS-TOKEN-001")).toBe(false);
    expect(report.suppressedFindings).toContainEqual(
      expect.objectContaining({
        ruleId: "AS-TOKEN-001",
        suppression: {
          reason: "Synthetic accepted-risk test",
          owner: "test-owner",
          expires: "2027-08-30",
        },
      }),
    );
  });

  it("surfaces an expired exception again", async () => {
    const target = await repositoryCopy();
    await writeFile(path.join(target, ".cydetix.json"), config("2026-08-29"), "utf8");
    const report = await scanRepository({ path: target, now: new Date("2026-08-30T00:00:00Z") });
    expect(report.findings.some((finding) => finding.ruleId === "AS-TOKEN-001")).toBe(true);
    expect(report.suppressedFindings.some((finding) => finding.ruleId === "AS-TOKEN-001")).toBe(
      false,
    );
  });

  it("supports exact-fingerprint baselines", async () => {
    const target = await repositoryCopy();
    const first = await scanRepository({ path: target });
    const token = first.findings.find((finding) => finding.ruleId === "AS-TOKEN-001");
    if (token === undefined) throw new Error("Expected token fixture finding.");
    await writeFile(
      path.join(target, ".cydetix.json"),
      `${JSON.stringify({ schemaVersion: "1.0.0", baseline: [token.fingerprint] }, null, 2)}\n`,
      "utf8",
    );
    const report = await scanRepository({ path: target });
    expect(report.findings.some((finding) => finding.fingerprint === token.fingerprint)).toBe(
      false,
    );
    expect(
      report.suppressedFindings.some((finding) => finding.fingerprint === token.fingerprint),
    ).toBe(true);
  });
});
