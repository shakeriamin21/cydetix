import { spawnSync } from "node:child_process";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { format } from "prettier";

const root = process.cwd();
try {
  await lstat(path.join(root, ".gitleaksignore"));
  throw new Error("Repository-controlled Gitleaks ignore file is forbidden.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const directory = path.resolve(".cydetix/v1-readiness-gitleaks");
await mkdir(directory, { recursive: true });
const sourceCommit = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  shell: false,
  windowsHide: true,
}).stdout.trim();
if (!/^[a-f0-9]{40}$/u.test(sourceCommit))
  throw new Error("Gitleaks could not resolve an exact source commit.");
const sourceState = spawnSync("git", ["status", "--porcelain", "--untracked-files=no"], {
  encoding: "utf8",
  shell: false,
  windowsHide: true,
});
if (sourceState.error !== undefined || sourceState.status !== 0)
  throw new Error("Gitleaks could not inspect the tracked source state.");
if (sourceState.stdout.trim() !== "")
  throw new Error("Gitleaks requires a clean tracked source commit.");
const user =
  process.platform === "win32" ? "1000:1000" : `${os.userInfo().uid}:${os.userInfo().gid}`;
const arguments_ = [
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
const started = performance.now();
const scan = spawnSync("docker", arguments_, {
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
  throw new Error("Independent Gitleaks history scan was incomplete.");
}
const reviewed = spawnSync(
  process.execPath,
  ["scripts/validate-gitleaks-report.mjs", path.join(directory, "report.json")],
  { encoding: "utf8", shell: false, windowsHide: true, timeout: 30_000, maxBuffer: 2_000_000 },
);
if (reviewed.error || reviewed.status !== 0)
  throw new Error("Independent Gitleaks report failed exact reviewed-finding validation.");
const review = JSON.parse(await readFile(".cydetix/evidence/gitleaks-review.json", "utf8"));
const report = {
  schemaVersion: "1.0.0",
  auditedSourceSha: sourceCommit,
  state: "PASSED",
  tool: {
    name: "gitleaks",
    version: "8.30.1",
    image:
      "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f",
  },
  durationMilliseconds: performance.now() - started,
  commitsScanned,
  scope:
    "Complete --all history, network denied, repository mounted read-only, no repository ignore file/directives, redacted report, exact reviewed non-secret fingerprints required.",
  review,
};
await writeFile(
  "validation/v1-readiness/gitleaks.json",
  await format(JSON.stringify(report), { parser: "json", printWidth: 100 }),
  "utf8",
);
process.stdout.write(
  `Gitleaks PASSED; ${commitsScanned} commits processed; ${review.findings} exact reviewed non-secret findings.\n`,
);
