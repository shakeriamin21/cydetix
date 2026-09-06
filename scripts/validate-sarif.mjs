import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { scanRepository } from "../dist/core/engine.js";
import { renderSarif } from "../dist/reporting/sarif.js";
import { resolveSarifMultitoolExecutable } from "../dist/validation/sarif-multitool.js";

const multitoolPath = await resolveSarifMultitoolExecutable();
const temporary = await mkdtemp(path.join(os.tmpdir(), "cydetix-sarif-"));
try {
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
    const result = spawnSync(
      multitoolPath,
      ["validate", "--threads", "1", sarifPath, "--quiet", "--level", "Error"],
      {
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: 90_000,
        maxBuffer: 1_000_000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (result.status !== 0) {
      process.stderr.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
      throw new Error(
        `Microsoft SARIF Multitool rejected ${name} output (exit ${result.status}; error ${String(result.error?.code ?? "none")}).`,
      );
    }
    process.stdout.write(
      `Microsoft SARIF Multitool validated ${name} in ${Date.now() - startedAt} ms.\n`,
    );
  }
  process.stdout.write(
    "Microsoft SARIF Multitool validated Phase 1-5 SARIF 2.1.0 output, including SAFE fixes, dependency/workflow code flows, and redacted secrets.\n",
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
