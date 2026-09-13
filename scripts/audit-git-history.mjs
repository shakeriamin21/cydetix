import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".");
const note =
  "This deterministic privacy audit complements, but does not replace, an independent secret scanner.";

class HistoryAuditError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

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
    throw new HistoryAuditError("GIT_HISTORY_AUDIT_UNAVAILABLE");
  return result.stdout;
}

function parseArguments(arguments_) {
  let enforce = false;
  let auditAll = false;
  let revision;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--enforce") {
      if (enforce) throw new HistoryAuditError("INVALID_HISTORY_SCOPE");
      enforce = true;
      continue;
    }
    if (argument === "--all") {
      if (auditAll) throw new HistoryAuditError("INVALID_HISTORY_SCOPE");
      auditAll = true;
      continue;
    }
    if (argument === "--ref") {
      if (revision !== undefined) throw new HistoryAuditError("INVALID_HISTORY_SCOPE");
      revision = arguments_[index + 1];
      index += 1;
      const hasControlCharacter = [...(revision ?? "")].some((character) => {
        const codePoint = character.codePointAt(0);
        return codePoint !== undefined && (codePoint < 0x20 || codePoint === 0x7f);
      });
      if (
        revision === undefined ||
        revision.length === 0 ||
        revision.length > 256 ||
        revision.startsWith("-") ||
        hasControlCharacter
      )
        throw new HistoryAuditError("INVALID_HISTORY_REF");
      continue;
    }
    throw new HistoryAuditError("INVALID_HISTORY_SCOPE");
  }

  if (auditAll === (revision !== undefined)) throw new HistoryAuditError("INVALID_HISTORY_SCOPE");
  return { enforce, auditAll, revision };
}

function resolveScope(options) {
  if (options.auditAll) {
    return {
      output: { mode: "ALL_REFS" },
      revisionArguments: ["--all"],
    };
  }

  let resolved;
  try {
    resolved = git([
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${options.revision}^{commit}`,
    ]).trim();
  } catch {
    throw new HistoryAuditError("INVALID_HISTORY_REF");
  }
  if (!/^[a-f0-9]{40}$/u.test(resolved)) throw new HistoryAuditError("INVALID_HISTORY_REF");

  return {
    output: {
      mode: "REACHABLE_FROM_REF",
      requestedRef: options.revision,
      resolvedCommit: resolved,
    },
    revisionArguments: ["--end-of-options", resolved],
  };
}

function parseMetadata(source) {
  const metadata = new Map();
  for (const row of source.split("\n").filter(Boolean)) {
    const fields = row.split("\0");
    if (fields.length !== 5) throw new HistoryAuditError("INVALID_AUTHOR_METADATA");
    const [commit, authorName, email, committerName, committerEmail] = fields;
    if (!/^[a-f0-9]{40}$/u.test(commit) || metadata.has(commit))
      throw new HistoryAuditError("INVALID_AUTHOR_METADATA");
    metadata.set(commit, { authorName, email, committerName, committerEmail });
  }
  return metadata;
}

const fingerprint = (value) => createHash("sha256").update(value).digest("hex");
const allowancePath = "validation/history-author-allowances.json";

async function loadAuthorAllowances() {
  let source;
  try {
    source = await readFile(path.join(root, allowancePath), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { entries: [] };
    throw new HistoryAuditError("INVALID_AUTHOR_ALLOWANCES");
  }
  try {
    const policy = JSON.parse(source);
    const exactKeys = (value, keys) =>
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).sort().join("|") === [...keys].sort().join("|");
    if (
      !exactKeys(policy, ["schemaVersion", "entries"]) ||
      policy.schemaVersion !== "1.0.0" ||
      !Array.isArray(policy.entries) ||
      policy.entries.length > 100
    )
      throw new Error("Invalid policy");
    const commits = new Set();
    for (const entry of policy.entries) {
      if (
        !exactKeys(entry, [
          "commit",
          "authorName",
          "authorEmailSha256",
          "committerName",
          "committerEmailSha256",
          "observedRef",
          "reason",
        ]) ||
        !/^[a-f0-9]{40}$/u.test(entry.commit) ||
        commits.has(entry.commit) ||
        !/^[a-f0-9]{64}$/u.test(entry.authorEmailSha256) ||
        !/^[a-f0-9]{64}$/u.test(entry.committerEmailSha256) ||
        ![entry.authorName, entry.committerName, entry.observedRef, entry.reason].every(
          (value) =>
            typeof value === "string" &&
            value.length > 0 &&
            value.length <= 2000 &&
            ![...value].some((character) => {
              const code = character.codePointAt(0);
              return code < 0x20 || code === 0x7f;
            }),
        ) ||
        !entry.observedRef.startsWith("refs/")
      )
        throw new Error("Invalid entry");
      commits.add(entry.commit);
    }
    return { entries: policy.entries, sha256: fingerprint(source) };
  } catch {
    throw new HistoryAuditError("INVALID_AUTHOR_ALLOWANCES");
  }
}

async function audit() {
  const options = parseArguments(process.argv.slice(2));
  const scope = resolveScope(options);
  const publication = JSON.parse(
    await readFile(path.join(root, "release", "publication-config.json"), "utf8"),
  );
  const approvedEmailHashes = new Set(publication.approvedHistoryAuthorEmailSha256 ?? []);
  const allowances = await loadAuthorAllowances();
  const appliedAllowances = [];
  const commits = git(["rev-list", ...scope.revisionArguments])
    .trim()
    .split("\n")
    .filter(Boolean)
    .sort();
  const metadata = parseMetadata(
    git([
      "log",
      "--format=%H%x00%an%x00%ae%x00%cn%x00%ce",
      ...(options.auditAll ? ["--all"] : scope.revisionArguments),
    ]),
  );
  const issues = [];
  if (commits.length === 0) issues.push({ code: "NO_PUBLIC_COMMITS" });
  for (const commit of commits) {
    const identity = metadata.get(commit);
    if (identity === undefined) {
      issues.push({ code: "MISSING_AUTHOR_METADATA", commit });
      continue;
    }
    const { email, authorName, committerName, committerEmail } = identity;
    if (email.endsWith(".invalid") || email.endsWith(".example")) continue;
    const emailFingerprint = fingerprint(email);
    if (!approvedEmailHashes.has(emailFingerprint)) {
      const allowance = allowances.entries.find(
        (entry) =>
          entry.commit === commit &&
          entry.authorName === authorName &&
          entry.authorEmailSha256 === emailFingerprint &&
          entry.committerName === committerName &&
          entry.committerEmailSha256 === fingerprint(committerEmail),
      );
      if (allowance) appliedAllowances.push({ commit, observedRef: allowance.observedRef });
      else issues.push({ code: "UNAPPROVED_AUTHOR_EMAIL", commit, fingerprint: emailFingerprint });
    }
  }

  const forbiddenNeedles = [
    {
      id: "LOCAL_WORKSPACE_PATH",
      value: ["Z:", "private-workspace-sentinel"].join("\\"),
    },
    {
      id: "LOCAL_USER_PROFILE",
      value: ["C:", "Users", "synthetic-user"].join("\\"),
    },
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
      issues.map((issue) => [
        `${issue.code}:${issue.path ?? issue.fingerprint ?? issue.commit}`,
        issue,
      ]),
    ).values(),
  ];
  const result = {
    schemaVersion: "1.0.0",
    state: uniqueIssues.length === 0 ? "PASS" : "FAIL",
    scope: scope.output,
    commitsReviewed: commits.length,
    issues: uniqueIssues,
    authorAllowances: {
      policy: allowances.sha256 ? allowancePath : null,
      policySha256: allowances.sha256 ?? null,
      applied: appliedAllowances,
      scope:
        "Exact immutable commit and author/committer tuple only; privacy approval does not authenticate a bot, approve code, or exclude content from scanning.",
    },
    note,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (options.enforce && uniqueIssues.length > 0) process.exitCode = 1;
}

try {
  await audit();
} catch (error) {
  const code = error instanceof HistoryAuditError ? error.code : "HISTORY_AUDIT_UNAVAILABLE";
  process.stdout.write(
    `${JSON.stringify(
      {
        schemaVersion: "1.0.0",
        state: "FAIL",
        scope: { mode: "INVALID" },
        commitsReviewed: 0,
        issues: [{ code }],
        note,
      },
      null,
      2,
    )}\n`,
  );
  process.exitCode = 1;
}
