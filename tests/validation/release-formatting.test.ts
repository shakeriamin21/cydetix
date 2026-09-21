import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { check, resolveConfig } from "prettier";
import { describe, expect, it } from "vitest";

import { formatRepositoryJson } from "../../scripts/lib/canonical-json.mjs";
import { currentReleaseValidationReportSchema } from "../../src/validation/release.js";
import { versionedReleaseReportPath } from "../../src/validation/release-evidence.js";
import { temporaryDirectory } from "../helpers/temporary.js";

const historicalReport = JSON.parse(
  await readFile("validation/releases/v1.0.1/validation-report.json", "utf8"),
) as Record<string, unknown>;
const validationPath = path.resolve(versionedReleaseReportPath("1.0.2"));

function realisticCurrentReport() {
  return currentReleaseValidationReportSchema.parse({
    ...historicalReport,
    schemaVersion: "1.3.0",
    generatedAt: "2026-09-21T00:00:00.000Z",
    product: {
      ...(historicalReport.product as Record<string, unknown>),
      version: "1.0.2",
      publicSourceCommit: "a".repeat(40),
    },
    verdict: "PUBLIC_STABLE_READY_WITH_LIMITATIONS",
  });
}

async function repositoryPrettierOptions() {
  return {
    ...((await resolveConfig(validationPath)) ?? {}),
    filepath: validationPath,
  };
}

describe("canonical release validation JSON", () => {
  it("formats a realistic release report with the exact CI contract", async () => {
    const report = realisticCurrentReport();
    const output = await formatRepositoryJson(report, validationPath);
    const options = await repositoryPrettierOptions();

    expect(Buffer.byteLength(output)).toBeGreaterThan(20_000);
    expect(await check(output, options)).toBe(true);
    expect(JSON.parse(output)).toEqual(report);
    expect(output.endsWith("\n")).toBe(true);
    expect(output).not.toContain(path.resolve("."));

    // This is the E1 failure mode: JSON.stringify output is valid JSON but is
    // not the repository's canonical Prettier document layout.
    const rawJsonStringifyOutput = `${JSON.stringify(report, null, 2)}\n`;
    expect(await check(rawJsonStringifyOutput, options)).toBe(false);
  });

  it("is byte-stable across parse and repeated generation", async () => {
    const report = realisticCurrentReport();
    const first = await formatRepositoryJson(report, validationPath);
    const roundTripped = JSON.parse(first) as unknown;
    const second = await formatRepositoryJson(roundTripped, validationPath);
    expect(second).toBe(first);

    const temporaryRoot = await temporaryDirectory("cydetix-release-format-");
    const outputPath = path.join(temporaryRoot, "validation-report.json");
    await writeFile(outputPath, first, "utf8");
    const firstWrite = await readFile(outputPath);
    await writeFile(outputPath, second, "utf8");
    expect(await readFile(outputPath)).toEqual(firstWrite);
  });
});
