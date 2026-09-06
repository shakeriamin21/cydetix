import { spawnSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".");

function git(arguments_) {
  const result = spawnSync(
    "git",
    ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...arguments_],
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 10_000_000,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        PATHEXT: process.env.PATHEXT,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
        GIT_TERMINAL_PROMPT: "0",
      },
    },
  );
  if (result.error !== undefined || result.status !== 0)
    throw new Error(`Public repository audit could not run git ${arguments_[0] ?? ""}.`);
  return result.stdout;
}

const publication = JSON.parse(
  await readFile(path.join(root, "release", "publication-config.json"), "utf8"),
);
const approvedEmails = new Set(publication.approvedPublicEmails ?? []);
const reviewedFiles = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
  .split("\0")
  .filter(Boolean);
const forbiddenRoots =
  /^(?:\.vibeshield|\.npm-cache|coverage|node_modules|validation\/external)(?:\/|$)/u;
const forbiddenArtifact = /\.(?:dump|log|p12|pfx|tmp)$/iu;
const personalWindowsPath = /\b[A-Za-z]:\\(?:private-workspace-sentinel|Users\\[^\\\s]+)(?:\\|\b)/u;
const personalPosixPath =
  /(?:^|[\s"'])\/(?:Users|home)\/[^/\s"']+\/(?:Desktop|Documents|Downloads)(?:\/|\b)/u;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const forbiddenNeedles = [
  ["Z:", "private-workspace-sentinel"].join("\\"),
  ["C:", "Users", "synthetic-user"].join("\\"),
  ["Codex", "Sandbox", "Offline"].join(""),
  ["vibeshield", "phase6", "cache"].join("-"),
];
const issues = [];
let bytesReviewed = 0;

for (const relative of reviewedFiles) {
  const normalized = relative.replaceAll("\\", "/");
  if (forbiddenRoots.test(normalized) || forbiddenArtifact.test(normalized)) {
    issues.push({ code: "UNEXPECTED_TRACKED_PATH", path: normalized });
    continue;
  }
  const absolute = path.join(root, relative);
  const metadata = await lstat(absolute);
  if (!metadata.isFile()) {
    issues.push({ code: "NON_REGULAR_TRACKED_ENTRY", path: normalized });
    continue;
  }
  if (metadata.size > 5_000_000) {
    issues.push({ code: "OVERSIZED_TRACKED_FILE", path: normalized, bytes: metadata.size });
    continue;
  }
  const content = await readFile(absolute);
  bytesReviewed += content.length;
  if (content.includes(0)) {
    issues.push({ code: "BINARY_TRACKED_FILE", path: normalized });
    continue;
  }
  const text = content.toString("utf8");
  if (personalWindowsPath.test(text) || personalPosixPath.test(text))
    issues.push({ code: "PERSONAL_MACHINE_PATH", path: normalized });
  for (const needle of forbiddenNeedles) {
    if (text.includes(needle))
      issues.push({ code: "DEVELOPER_SPECIFIC_CONTENT", path: normalized });
  }
  for (const email of text.match(emailPattern) ?? []) {
    if (!email.endsWith(".invalid") && !email.endsWith(".example") && !approvedEmails.has(email))
      issues.push({ code: "UNAPPROVED_PUBLIC_EMAIL", path: normalized });
  }
}

const uniqueIssues = [
  ...new Map(issues.map((issue) => [`${issue.code}:${issue.path}`, issue])).values(),
];
const result = {
  schemaVersion: "1.0.0",
  state: uniqueIssues.length === 0 ? "PASS" : "FAIL",
  filesReviewed: reviewedFiles.length,
  scope: "TRACKED_AND_UNTRACKED_NOT_IGNORED",
  bytesReviewed,
  issues: uniqueIssues,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (uniqueIssues.length > 0) process.exitCode = 1;
