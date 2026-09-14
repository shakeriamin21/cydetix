import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { scanRepository } from "../dist/core/engine.js";
import { renderSarif } from "../dist/reporting/sarif.js";
import { resolveSarifMultitoolExecutable } from "../dist/validation/sarif-multitool.js";
import {
  downloadOfficialSarifSchema,
  assertSarifValidationResult,
  runSarifMultitoolWithTimeoutRetry,
} from "./official-sarif-schema.mjs";

const multitoolPath = await resolveSarifMultitoolExecutable();
const PROCESS_TIMEOUT_MILLISECONDS = 210_000;
const temporary = await mkdtemp(path.join(os.tmpdir(), "cydetix-sarif-"));
try {
  // Retain the exact official schema used by the report's $schema. Fetch once through
  // a bounded, checksum-pinned request; the Multitool must not repeatedly fetch it.
  const schemaPath = path.join(temporary, "official-sarif-schema.json");
  await writeFile(schemaPath, await downloadOfficialSarifSchema());
  const fixtures = [
    ["phase-one", path.resolve("fixtures", "typescript", "vulnerable"), {}],
    [
      "phase-two-code-flow",
      path.resolve("fixtures", "phase2", "express-prisma", "idor-vulnerable"),
      {},
    ],
    [
      "phase-three-authentication-code-flow",
      path.resolve("fixtures", "phase3", "reset-persistent-sessions"),
      {},
    ],
    [
      "phase-four-workflow-code-flow",
      path.resolve("fixtures", "phase4", "actions-pr-target-dangerous"),
      {},
    ],
    ["phase-four-secret-redaction", path.resolve("fixtures", "phase4", "secret-exposed"), {}],
    [
      "phase-four-dependency-code-flow",
      path.resolve("fixtures", "phase4", "dependencies-vulnerable"),
      {
        advisories: "online",
        advisoryProvider: {
          name: "OSV-fixture",
          endpoint: "https://example.invalid/osv-fixture",
          query(packages) {
            const component = packages.find((candidate) => candidate.name === "transitive-vuln");
            return Promise.resolve(
              component === undefined
                ? []
                : [
                    {
                      id: "OSV-FIXTURE-TRANSITIVE",
                      aliases: [],
                      packagePurl: component.purl,
                      fixedVersions: ["3.1.1"],
                      references: ["https://example.invalid/advisory"],
                      provider: "OSV-fixture",
                    },
                  ],
            );
          },
        },
      },
    ],
  ];
  for (const [name, fixturePath, options] of fixtures) {
    const startedAt = Date.now();
    const sarifPath = path.join(temporary, `${name}.sarif`);
    const report = await scanRepository({ path: fixturePath, ...options });
    await writeFile(sarifPath, renderSarif(report), "utf8");
    const execution = runSarifMultitoolWithTimeoutRetry(
      spawnSync,
      multitoolPath,
      ["validate", sarifPath, "--json-schema", schemaPath, "--threads", "1", "--level", "Error"],
      {
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: PROCESS_TIMEOUT_MILLISECONDS,
        maxBuffer: 1_000_000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const { result } = execution;
    if (execution.attempts > 1)
      process.stderr.write(
        `Microsoft SARIF Multitool initial ${name} attempt timed out; evaluated bounded attempt 2/2.\n`,
      );
    try {
      assertSarifValidationResult(result);
    } catch (error) {
      process.stderr.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
      throw new Error(
        `Microsoft SARIF Multitool rejected ${name} output (exit ${result.status}; error ${String(result.error?.code ?? "none")}): ${error.message}`,
        { cause: error },
      );
    }
    process.stdout.write(
      `Microsoft SARIF Multitool validated ${name} in ${Date.now() - startedAt} ms.\n`,
    );
  }
  const valid = JSON.parse(renderSarif(await scanRepository({ path: fixtures[0][1] })));
  for (const [name, mutate] of [
    [
      "schema-negative",
      (report) => {
        delete report.runs[0].tool.driver.name;
      },
    ],
    [
      "semantic-negative",
      (report) => {
        report.runs[0].results[0].ruleIndex = 999_999;
      },
    ],
  ]) {
    const invalid = JSON.parse(JSON.stringify(valid));
    mutate(invalid);
    const invalidPath = path.join(temporary, `${name}.sarif`);
    await writeFile(invalidPath, JSON.stringify(invalid));
    const execution = runSarifMultitoolWithTimeoutRetry(
      spawnSync,
      multitoolPath,
      ["validate", invalidPath, "--json-schema", schemaPath, "--threads", "1", "--level", "Error"],
      {
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: PROCESS_TIMEOUT_MILLISECONDS,
        maxBuffer: 1_000_000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const { result: rejected } = execution;
    if (execution.attempts > 1)
      process.stderr.write(
        `Microsoft SARIF Multitool initial ${name} attempt timed out; evaluated bounded attempt 2/2.\n`,
      );
    assertSarifValidationResult(rejected, name === "schema-negative" ? "JSON" : "SARIF");
    process.stdout.write(`Microsoft SARIF Multitool explicitly rejected ${name}.\n`);
  }
  process.stdout.write(
    "Microsoft SARIF Multitool validated Phase 1-5 SARIF 2.1.0 output, including SAFE fixes, dependency/workflow code flows, and redacted secrets.\n",
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
