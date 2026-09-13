import { spawnSync } from "node:child_process";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { performance } from "node:perf_hooks";

const root = process.cwd();
try {
  await lstat(path.join(root, ".gitleaksignore"));
  throw new Error("Repository-controlled Gitleaks ignore file is forbidden.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const directory = path.resolve(".cydetix/alpha12/gitleaks");
await mkdir(directory, { recursive: true });
const sourceCommit = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  windowsHide: true,
}).stdout.trim();
const user =
  process.platform === "win32" ? "1000:1000" : `${os.userInfo().uid}:${os.userInfo().gid}`;
const args = [
  "run",
  "--rm",
  "--network",
  "none",
  "--read-only",
  "--cap-drop",
  "ALL",
  "--security-opt",
  "no-new-privileges",
  "--pids-limit",
  "128",
  "--memory",
  "512m",
  "--cpus",
  "1",
  "--user",
  user,
  "-e",
  "GIT_CONFIG_COUNT=1",
  "-e",
  "GIT_CONFIG_KEY_0=safe.directory",
  "-e",
  "GIT_CONFIG_VALUE_0=/repo",
  "--mount",
  `type=bind,source=${root},target=/repo,readonly`,
  "--mount",
  `type=bind,source=${directory},target=/evidence`,
  "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f",
  "git",
  "/repo",
  "--redact=100",
  "--report-format",
  "json",
  "--report-path",
  "/evidence/report.json",
  "--config",
  "/repo/validation/gitleaks.toml",
  "--gitleaks-ignore-path",
  "/dev/null",
  "--ignore-gitleaks-allow",
  "--log-opts=--full-history --all --text --no-textconv --no-ext-diff",
  "--no-banner",
  "--no-color",
  "--exit-code",
  "0",
  "--timeout",
  "180",
];
const startedAt = new Date().toISOString();
const started = performance.now();
const scan = spawnSync("docker", args, {
  encoding: "utf8",
  shell: false,
  windowsHide: true,
  timeout: 240_000,
  maxBuffer: 2_000_000,
});
const commitsScanned = Number(/\b(\d+) commits scanned\./u.exec(scan.stderr ?? "")?.[1] ?? 0);
if (
  scan.error ||
  scan.status !== 0 ||
  commitsScanned === 0 ||
  /\b(?:ERR|FTL)\b/u.test(scan.stderr ?? "")
) {
  process.stderr.write(scan.stderr ?? "");
  throw new Error(
    "Independent Gitleaks execution was incomplete or failed; no passing evidence is recorded.",
  );
}
const reviewed = spawnSync(
  process.execPath,
  ["scripts/validate-gitleaks-report.mjs", path.join(directory, "report.json")],
  { encoding: "utf8", shell: false, windowsHide: true, timeout: 30_000, maxBuffer: 2_000_000 },
);
if (reviewed.error || reviewed.status !== 0) {
  process.stderr.write(reviewed.stderr ?? "");
  throw new Error("Independent Gitleaks report failed exact history review.");
}
const result = {
  schemaVersion: "1.0.0",
  sourceCommit,
  startedAt,
  state: "PASSED",
  durationMilliseconds: performance.now() - started,
  commitsScanned,
  command: ["docker", ...args.map((a) => a.replaceAll(root, "<workspace>"))],
  executionLog: scan.stderr,
  review: JSON.parse(await readFile(".cydetix/evidence/gitleaks-review.json", "utf8")),
  scope:
    "All reachable refs; Gitleaks commit count reflects commits it processes with content, while the deterministic metadata audit counts every reachable commit. Exit success alone is insufficient: execution errors, zero commits and missing immutable reviewed findings are rejected.",
};
await writeFile(
  "validation/alpha12/gitleaks-execution.json",
  `${JSON.stringify(result, null, 2)}\n`,
);
process.stdout.write(
  `Gitleaks PASSED; ${commitsScanned} commits processed; ${result.review.findings} exact reviewed non-secret findings.\n`,
);
