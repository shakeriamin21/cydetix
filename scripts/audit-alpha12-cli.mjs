import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { scanReportSchema } from "../dist/core/schema.js";

const scratch = await mkdtemp(path.resolve(".cydetix/alpha12/cli-"));
const project = path.join(scratch, "Project With Spaces");
const home = path.join(scratch, "home");
await cp("fixtures/phase4/actions-tagged", project, { recursive: true });
await mkdir(home);
const cli = path.resolve("dist/cli/main.js");
const normalize = (text) =>
  text
    .replaceAll(scratch, "<temporary>")
    .replaceAll(scratch.replaceAll("\\", "/"), "<temporary>")
    .replaceAll(process.cwd(), "<cydetix>")
    .replaceAll(process.cwd().replaceAll("\\", "/"), "<cydetix>");
const cases = [
  { name: "default", args: [], expected: 0 },
  { name: "help", args: ["--help"], expected: 0 },
  { name: "version", args: ["--version"], expected: 0 },
  { name: "setup", args: ["setup"], expected: 0 },
  { name: "status", args: ["status"], expected: 0 },
  { name: "scan", args: ["scan"], expected: 0 },
  { name: "fix", args: ["fix"], expected: 6 },
  { name: "explain-missing", args: ["explain"], expected: 2 },
  { name: "explain", args: ["explain", "AS-CI-001"], expected: 0 },
  { name: "explain-json", args: ["explain", "AS-CI-001", "--format", "json"], expected: 0 },
  { name: "scan-json", args: ["scan", "--format", "json"], expected: 0 },
  { name: "scan-sarif", args: ["scan", "--format", "sarif"], expected: 0 },
  { name: "ci-json", args: ["ci", "--format", "json", "--fail-on", "low"], expected: 1 },
  { name: "unknown-rule", args: ["explain", "AS-NOT-REAL"], expected: 2 },
  { name: "missing-path", args: ["scan", "absent-directory"], expected: 3 },
];
const casesEvidence = [];
for (const test of cases) {
  const result = spawnSync(process.execPath, [cli, ...test.args], {
    cwd: project,
    shell: false,
    windowsHide: true,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 10_000_000,
    env: { ...process.env, CYDETIX_SETUP_HOME: home, CI: "true", NO_COLOR: "1" },
  });
  if (result.error) throw result.error;
  let structure = null;
  if (test.name === "scan-json") {
    const report = scanReportSchema.parse(JSON.parse(result.stdout));
    structure = {
      schema: "PASSED",
      findings: report.findings.length,
      proofStates: report.findings.map((f) => f.proofState),
      remediation: report.findings.map((f) => f.remediationClass),
    };
  } else if (test.name === "scan-sarif") {
    const sarif = JSON.parse(result.stdout);
    structure = { version: sarif.version, findings: sarif.runs[0].results.length };
  }
  casesEvidence.push({
    command: ["cydetix", ...test.args],
    name: test.name,
    expectedExit: test.expected,
    actualExit: result.status,
    state: result.status === test.expected ? "PASSED" : "FAILED",
    structure,
    stdout:
      test.name.endsWith("json") || test.name.endsWith("sarif") ? null : normalize(result.stdout),
    stderr: normalize(result.stderr),
    stdoutSha256: createHash("sha256").update(result.stdout).digest("hex"),
  });
}
const evidence = {
  schemaVersion: "1.0.0",
  sourceCommit: spawnSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  }).stdout.trim(),
  version: "0.6.0-alpha.12",
  fixture: "fixtures/phase4/actions-tagged",
  execution:
    "Non-interactive child CLI processes in an isolated fixture copy and setup home. fix has no SAFE plan and is withheld. Actual SAFE patch/rollback is covered separately by CLI and sandbox tests.",
  cases: casesEvidence,
};
await writeFile("validation/alpha12/cli-audit.json", `${JSON.stringify(evidence, null, 2)}\n`);
for (const result of casesEvidence)
  process.stdout.write(`${result.name}: ${result.state}; exit ${result.actualExit}\n`);
if (casesEvidence.some((result) => result.state !== "PASSED")) process.exitCode = 1;
