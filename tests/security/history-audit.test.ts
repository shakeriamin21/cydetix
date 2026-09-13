import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { temporaryDirectory } from "../helpers/temporary.js";

const auditScript = path.resolve("scripts", "audit-git-history.mjs");
const approvedEmail = ["approved-maintainer", ["cydetix", "test"].join(".")].join("@");
const unapprovedEmail = [
  "49699333+dependabot[bot]",
  ["users", "noreply", "github", "com"].join("."),
].join("@");

function commandEnvironment(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    PATHEXT: process.env.PATHEXT,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
  };
}

function git(repository: string, arguments_: string[]): string {
  const result = spawnSync("git", arguments_, {
    cwd: repository,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 20_000,
    env: commandEnvironment(),
  });
  if (result.error !== undefined || result.status !== 0)
    throw new Error(`Test Git command failed: ${arguments_[0] ?? "unknown"}.`);
  return result.stdout.trim();
}

function runAudit(repository: string, arguments_: string[]) {
  const result = spawnSync(process.execPath, [auditScript, ...arguments_], {
    cwd: repository,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 20_000,
    env: commandEnvironment(),
  });
  if (result.error !== undefined) throw result.error;
  return {
    status: result.status,
    stdout: result.stdout,
    report: JSON.parse(result.stdout) as {
      state: string;
      scope: { mode: string; requestedRef?: string; resolvedCommit?: string };
      commitsReviewed: number;
      issues: Array<{ code: string; commit?: string; fingerprint?: string }>;
      authorAllowances?: { applied: Array<{ commit: string; observedRef: string }> };
    },
  };
}

async function createRepository() {
  const repository = await temporaryDirectory("cydetix-history-audit-");
  await mkdir(path.join(repository, "release"), { recursive: true });
  await writeFile(
    path.join(repository, "release", "publication-config.json"),
    `${JSON.stringify({
      approvedHistoryAuthorEmailSha256: [createHash("sha256").update(approvedEmail).digest("hex")],
    })}\n`,
    "utf8",
  );
  await writeFile(path.join(repository, "README.md"), "approved history\n", "utf8");
  git(repository, ["init", "--initial-branch=main"]);
  git(repository, ["config", "user.name", "Approved Maintainer"]);
  git(repository, ["config", "user.email", approvedEmail]);
  git(repository, ["add", "."]);
  git(repository, ["commit", "-m", "initial approved commit"]);
  await writeFile(path.join(repository, "approved.txt"), "approved release content\n", "utf8");
  git(repository, ["add", "approved.txt"]);
  git(repository, ["commit", "-m", "approved release commit"]);
  return repository;
}

async function commitAs(
  repository: string,
  branch: string,
  email: string,
  file: string,
  content: string,
) {
  git(repository, ["switch", branch]);
  await writeFile(path.join(repository, file), content, "utf8");
  git(repository, ["add", file]);
  git(repository, [
    "-c",
    `user.name=${email === approvedEmail ? "Approved Maintainer" : "dependabot[bot]"}`,
    "-c",
    `user.email=${email}`,
    "commit",
    "-m",
    `add ${file}`,
  ]);
  return git(repository, ["rev-parse", "HEAD"]);
}

async function writeAllowance(repository: string, commit: string, changes = {}) {
  const entry = {
    commit,
    authorName: "dependabot[bot]",
    authorEmailSha256: createHash("sha256").update(unapprovedEmail).digest("hex"),
    committerName: "dependabot[bot]",
    committerEmailSha256: createHash("sha256").update(unapprovedEmail).digest("hex"),
    observedRef: "refs/heads/main",
    reason: "Explicit privacy approval of this immutable synthetic test commit only.",
    ...changes,
  };
  await mkdir(path.join(repository, "validation"), { recursive: true });
  await writeFile(
    path.join(repository, "validation/history-author-allowances.json"),
    JSON.stringify({ schemaVersion: "1.0.0", entries: [entry] }),
  );
  return entry;
}

describe("release Git-history privacy scope", () => {
  it("applies an exact immutable identity allowance deterministically and rejects future bot commits", async () => {
    const repository = await createRepository();
    const commit = await commitAs(
      repository,
      "main",
      unapprovedEmail,
      "bot.txt",
      "dependency update\n",
    );
    await writeAllowance(repository, commit);
    const first = runAudit(repository, ["--enforce", "--all"]);
    expect(first.status).toBe(0);
    expect(first.stdout).toBe(runAudit(repository, ["--enforce", "--all"]).stdout);
    expect(first.report.authorAllowances?.applied).toEqual([
      { commit, observedRef: "refs/heads/main" },
    ]);
    const future = await commitAs(
      repository,
      "main",
      unapprovedEmail,
      "future.txt",
      "next update\n",
    );
    const result = runAudit(repository, ["--enforce", "--all"]);
    expect(result.status).toBe(1);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({ code: "UNAPPROVED_AUTHOR_EMAIL", commit: future }),
    );
    expect(result.stdout).not.toContain(unapprovedEmail);
  });

  it.each([
    { commit: "0".repeat(40) },
    { authorName: "another-bot" },
    { authorEmailSha256: "0".repeat(64) },
    { committerName: "another-committer" },
    { committerEmailSha256: "0".repeat(64) },
  ])("withholds an allowance when an immutable identity field differs: %j", async (changes) => {
    const repository = await createRepository();
    const commit = await commitAs(repository, "main", unapprovedEmail, "bot.txt", "update\n");
    await writeAllowance(repository, commit, changes);
    const result = runAudit(repository, ["--enforce", "--all"]);
    expect(result.status).toBe(1);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({ code: "UNAPPROVED_AUTHOR_EMAIL", commit }),
    );
  });

  it("rejects malformed, duplicate and overbroad allowance policies", async () => {
    const repository = await createRepository();
    const entry = await writeAllowance(repository, git(repository, ["rev-parse", "HEAD"]));
    for (const value of [
      "{",
      JSON.stringify({ schemaVersion: "1.0.0", entries: [entry, entry] }),
      JSON.stringify({ schemaVersion: "1.0.0", entries: [{ ...entry, authorEmailSha256: "*" }] }),
      JSON.stringify({ schemaVersion: "1.0.0", entries: [entry], allowBots: true }),
      JSON.stringify({ schemaVersion: "1.0.0", entries: [{ ...entry, allowFutureCommits: true }] }),
    ]) {
      await writeFile(path.join(repository, "validation/history-author-allowances.json"), value);
      const result = runAudit(repository, ["--enforce", "--all"]);
      expect(result.status).toBe(1);
      expect(result.report.issues).toEqual([{ code: "INVALID_AUTHOR_ALLOWANCES" }]);
    }
  });

  it("still scans forbidden content in a privacy-approved machine commit", async () => {
    const repository = await createRepository();
    const commit = await commitAs(
      repository,
      "main",
      unapprovedEmail,
      "bot.txt",
      ["Z:", "private-workspace-sentinel"].join("\\"),
    );
    await writeAllowance(repository, commit);
    const result = runAudit(repository, ["--enforce", "--all"]);
    expect(result.status).toBe(1);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({ code: "LOCAL_WORKSPACE_PATH", commit }),
    );
    expect(result.report.issues.some((issue) => issue.code === "UNAPPROVED_AUTHOR_EMAIL")).toBe(
      false,
    );
  });

  it("passes approved release ancestry while an unapproved side branch remains unreachable", async () => {
    const repository = await createRepository();
    const releaseCommit = git(repository, ["rev-parse", "main"]);
    git(repository, ["switch", "-c", "unrelated"]);
    const unrelatedCommit = await commitAs(
      repository,
      "unrelated",
      unapprovedEmail,
      "dependency.txt",
      "unrelated dependency update\n",
    );
    git(repository, ["switch", "main"]);

    const releaseResult = runAudit(repository, ["--enforce", "--ref", releaseCommit]);
    expect(releaseResult.status).toBe(0);
    expect(releaseResult.report.state).toBe("PASS");
    expect(releaseResult.report.scope).toEqual({
      mode: "REACHABLE_FROM_REF",
      requestedRef: releaseCommit,
      resolvedCommit: releaseCommit,
    });
    expect(releaseResult.stdout).not.toContain(unrelatedCommit);

    const repositoryWideResult = runAudit(repository, ["--enforce", "--all"]);
    expect(repositoryWideResult.status).toBe(1);
    expect(repositoryWideResult.report.scope).toEqual({ mode: "ALL_REFS" });
    expect(repositoryWideResult.report.issues).toContainEqual(
      expect.objectContaining({ code: "UNAPPROVED_AUTHOR_EMAIL", commit: unrelatedCommit }),
    );
  });

  it("fails when an unapproved author is directly in release ancestry", async () => {
    const repository = await createRepository();
    const unapprovedCommit = await commitAs(
      repository,
      "main",
      unapprovedEmail,
      "reachable.txt",
      "reachable unapproved change\n",
    );

    const result = runAudit(repository, ["--enforce", "--ref", "main"]);
    expect(result.status).toBe(1);
    expect(result.report.state).toBe("FAIL");
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({ code: "UNAPPROVED_AUTHOR_EMAIL", commit: unapprovedCommit }),
    );
  });

  it("reports every unapproved commit even when the identity is shared", async () => {
    const repository = await createRepository();
    const first = await commitAs(repository, "main", unapprovedEmail, "first.txt", "first\n");
    const second = await commitAs(repository, "main", unapprovedEmail, "second.txt", "second\n");
    const result = runAudit(repository, ["--enforce", "--all"]);
    expect(result.status).toBe(1);
    expect(
      result.report.issues
        .filter((issue) => issue.code === "UNAPPROVED_AUTHOR_EMAIL")
        .map((issue) => issue.commit)
        .sort(),
    ).toEqual([first, second].sort());
  });

  it("fails once an unapproved side branch is merged into release ancestry", async () => {
    const repository = await createRepository();
    git(repository, ["switch", "-c", "dependency-update"]);
    const unapprovedCommit = await commitAs(
      repository,
      "dependency-update",
      unapprovedEmail,
      "dependency.txt",
      "merged dependency update\n",
    );
    git(repository, ["switch", "main"]);
    git(repository, ["merge", "--no-ff", "dependency-update", "-m", "merge dependency update"]);

    const result = runAudit(repository, ["--enforce", "--ref", "main"]);
    expect(result.status).toBe(1);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({ code: "UNAPPROVED_AUTHOR_EMAIL", commit: unapprovedCommit }),
    );
  });

  it("still rejects forbidden privacy evidence in reachable ancestry deterministically", async () => {
    const repository = await createRepository();
    await commitAs(
      repository,
      "main",
      approvedEmail,
      "privacy-evidence.txt",
      `${["Z:", "private-workspace-sentinel"].join("\\")}\n${["Codex", "Sandbox", "Offline"].join(
        "",
      )}\n`,
    );

    const first = runAudit(repository, ["--enforce", "--ref", "main"]);
    const second = runAudit(repository, ["--enforce", "--ref", "main"]);
    expect(first.status).toBe(1);
    expect(first.stdout).toBe(second.stdout);
    expect(first.report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["LOCAL_WORKSPACE_PATH", "LOCAL_SANDBOX_NAME"]),
    );
  });

  it("fails closed for missing and malformed target refs", async () => {
    const repository = await createRepository();

    const missingScope = runAudit(repository, ["--enforce"]);
    expect(missingScope.status).toBe(1);
    expect(missingScope.report.issues).toEqual([{ code: "INVALID_HISTORY_SCOPE" }]);

    const missingValue = runAudit(repository, ["--enforce", "--ref"]);
    expect(missingValue.status).toBe(1);
    expect(missingValue.report.issues).toEqual([{ code: "INVALID_HISTORY_REF" }]);

    const malformedRef = runAudit(repository, ["--enforce", "--ref", "refs/tags/does-not-exist"]);
    expect(malformedRef.status).toBe(1);
    expect(malformedRef.report.issues).toEqual([{ code: "INVALID_HISTORY_REF" }]);
  });
});
