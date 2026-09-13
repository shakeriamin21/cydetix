import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { performance } from "node:perf_hooks";

const id = process.argv[2];
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run through npm run gate:alpha12 -- <gate>.");
const gates = {
  audit: ["audit", "--json", "--audit-level=high"],
  osv: ["run", "validate:online-osv"],
  verify: ["run", "verify:development"],
  tests: ["test", "--", "--reporter=json", "--outputFile=.cydetix/alpha12/tests.json"],
  install: ["ci", "--ignore-scripts"],
  package: ["run", "validate:package"],
  packedInstall: ["run", "validate:install"],
  packedPlugin: ["run", "validate:packed-plugin"],
  workflow: ["run", "validate:workflow-security"],
  privacy: ["run", "audit:public-repository"],
  licenses: ["run", "audit:licenses"],
  history: ["run", "audit:history", "--", "--enforce", "--all"],
  selfScan: ["run", "release:self-scan"],
  externalNodeGoat: [
    "run",
    "validate:external",
    "--",
    "validation/corpora/owasp-nodegoat.json",
    ".cydetix/corpora/NodeGoat",
  ],
  externalPython: [
    "run",
    "validate:external",
    "--",
    "validation/corpora/owasp-benchmark-python.json",
    ".cydetix/corpora/BenchmarkPython",
  ],
  phase2: ["run", "benchmark:phase2"],
  phase3: ["run", "benchmark:phase3"],
  phase4: ["run", "benchmark:phase4"],
  phase5: ["run", "benchmark:phase5"],
  phase6: ["run", "benchmark:phase6"],
  batch1: ["run", "benchmark:batch1"],
  batch2: ["run", "benchmark:batch2"],
};
if (!Object.hasOwn(gates, id)) throw new Error("Unknown fixed validation gate");
const sourceCommit = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  shell: false,
  windowsHide: true,
}).stdout.trim();
const args = gates[id];
const root = path.resolve(".cydetix/alpha12/gates");
await mkdir(root, { recursive: true });
let stdout = "";
let stderr = "";
let outputLimited = false;
const startedAt = new Date().toISOString();
const started = performance.now();
const child = spawn(process.execPath, [npmCli, ...args], {
  shell: false,
  windowsHide: true,
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  if (stdout.length + chunk.length > 20_000_000) outputLimited = true;
  else stdout += chunk;
});
child.stderr.on("data", (chunk) => {
  if (stderr.length + chunk.length > 20_000_000) outputLimited = true;
  else stderr += chunk;
});
const result = await new Promise((resolve) => {
  child.on("error", (error) => resolve({ exitCode: null, error: error.message }));
  child.on("close", (exitCode, signal) => resolve({ exitCode, signal }));
});
await writeFile(path.join(root, `${id}.stdout.txt`), stdout);
await writeFile(path.join(root, `${id}.stderr.txt`), stderr);
const sha = (value) => createHash("sha256").update(value).digest("hex");
const record = {
  id,
  sourceCommit,
  command: ["npm", ...args],
  startedAt,
  durationMilliseconds: performance.now() - started,
  ...result,
  outputLimited,
  state: result.exitCode === 0 && !outputLimited ? "PASSED" : "FAILED",
  stdoutSha256: sha(stdout),
  stderrSha256: sha(stderr),
  sandboxImage: process.env.CYDETIX_SANDBOX_IMAGE ?? null,
};
await writeFile(path.join(root, `${id}.json`), `${JSON.stringify(record, null, 2)}\n`);
process.stdout.write(
  `${id}: ${record.state}; ${record.durationMilliseconds.toFixed(0)} ms. Logs: .cydetix/alpha12/gates/${id}.*\n`,
);
if (record.state !== "PASSED") {
  process.stderr.write(stderr.slice(-4000));
  process.stdout.write(stdout.slice(-4000));
  process.exitCode = 1;
}
