import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";

import {
  completeEvidence,
  establishEvidenceSource,
  fileIdentity,
} from "./lib/source-bound-evidence.mjs";

const npmCli = process.env.npm_execpath;
if (npmCli === undefined) throw new Error("npm_execpath is required; invoke through npm run.");
const source = await establishEvidenceSource();
const raw = path.resolve(".cydetix", "evidence", "tests.json");
const output = path.resolve(".cydetix", "evidence", "bound", "complete-test-suite.json");
await rm(raw, { force: true });
await rm(output, { force: true });
const result = spawnSync(
  process.execPath,
  [npmCli, "test", "--", "--reporter=json", `--outputFile=${raw}`],
  {
    cwd: source.root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 900_000,
    maxBuffer: 20_000_000,
    env: { ...process.env, CYDETIX_EXPECTED_SOURCE_SHA: source.sourceCommit },
  },
);
const passed = result.error === undefined && result.status === 0;
const subject = await fileIdentity(raw);
await completeEvidence(
  source,
  {
    evidenceType: "complete-test-suite",
    producer: { name: "generate-release-test-evidence", version: "1.0.0" },
    result: passed ? "PASS" : "FAIL",
    subject,
    details: { exitCode: result.status, errorCode: result.error?.code ?? null },
  },
  output,
);
if (!passed)
  throw new Error(
    `Release test suite failed: ${String(result.stderr ?? "")
      .trim()
      .slice(-2_000)}`,
  );
process.stdout.write(`Recorded complete-test-suite PASS for ${source.sourceCommit}.\n`);
