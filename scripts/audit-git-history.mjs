import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".");

function git(arguments_, acceptedStatuses = [0]) {
  const result = spawnSync(
    "git",
    ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...arguments_],
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 20_000_000,
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
  if (result.error !== undefined || !acceptedStatuses.includes(result.status))
    throw new Error(`Git history audit could not run git ${arguments_[0] ?? ""}.`);
  return result.stdout;
}

const publication = JSON.parse(
  await readFile(path.join(root, "release", "publication-config.json"), "utf8"),
);
const approvedEmailHashes = new Set(publication.approvedHistoryAuthorEmailSha256 ?? []);
const commits = git(["rev-list", "--all"]).trim().split("\n").filter(Boolean);
const metadata = git(["log", "--all", "--format=%H%x00%ae%x00"]).split("\n").filter(Boolean);
const issues = [];
if (commits.length === 0) issues.push({ code: "NO_PUBLIC_COMMITS" });
for (const row of metadata) {
  const [commit, email] = row.split("\0");
  if (email === undefined || email.endsWith(".invalid") || email.endsWith(".example")) continue;
  const fingerprint = createHash("sha256").update(email).digest("hex");
  if (!approvedEmailHashes.has(fingerprint))
    issues.push({ code: "UNAPPROVED_AUTHOR_EMAIL", commit, fingerprint });
}

const forbiddenNeedles = [
  {
    id: "LOCAL_WORKSPACE_PATH",
    value: ["Z:", "private-workspace-sentinel"].join("\\"),
  },
  { id: "LOCAL_USER_PROFILE", value: ["C:", "Users", "synthetic-user"].join("\\") },
  { id: "LOCAL_SANDBOX_NAME", value: ["Codex", "Sandbox", "Offline"].join("") },
  { id: "LOCAL_CACHE_NAME", value: ["cydetix", "phase6", "cache"].join("-") },
];
for (const commit of commits) {
  for (const needle of forbiddenNeedles) {
    const matches = git(["grep", "-I", "-l", "-F", needle.value, commit, "--"], [0, 1])
      .trim()
      .split("\n")
      .filter(Boolean);
    for (const match of matches) {
      const separator = match.indexOf(":");
      issues.push({
        code: needle.id,
        commit,
        path: separator === -1 ? match : match.slice(separator + 1),
      });
    }
  }
}

const uniqueIssues = [
  ...new Map(
    issues.map((issue) => [`${issue.code}:${issue.path ?? issue.fingerprint}`, issue]),
  ).values(),
];
const result = {
  schemaVersion: "1.0.0",
  state: uniqueIssues.length === 0 ? "PASS" : "FAIL",
  commitsReviewed: commits.length,
  issues: uniqueIssues,
  note: "This deterministic privacy audit complements, but does not replace, an independent secret scanner.",
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (process.argv.includes("--enforce") && uniqueIssues.length > 0) process.exitCode = 1;
