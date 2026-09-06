import { spawnSync } from "node:child_process";
import { appendFile, chmod, cp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { scanRepository } from "../../src/core/engine.js";
import {
  executeSafeTransaction,
  inspectGitState,
  runRemediation,
} from "../../src/remediation/fix.js";
import type { RemediationCandidate, RemediationReport } from "../../src/remediation/model.js";
import { temporaryDirectory } from "../helpers/temporary.js";

async function copyFixture(name: string): Promise<string> {
  const temp = await temporaryDirectory("invariantsec-remediation-");
  const target = path.join(temp, "repo");
  await cp(path.resolve("fixtures", name), target, { recursive: true });
  return target;
}

function transactionContext(root: string, report: RemediationReport) {
  return {
    repositoryIdentity: report.repository.identity,
    gitState: inspectGitState(root),
    planningMilliseconds: 0,
  };
}

function git(root: string, ...arguments_: string[]): void {
  const nullDevice = process.platform === "win32" ? "NUL" : "/dev/null";
  const result = spawnSync("git", ["-c", `core.hooksPath=${nullDevice}`, ...arguments_], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error(result.stderr);
}

function initializeGit(root: string): void {
  git(root, "init");
  git(root, "config", "user.email", "invariantsec@example.invalid");
  git(root, "config", "user.name", "InvariantSec Test");
  git(root, "add", ".");
  git(root, "commit", "-m", "fixture baseline", "--no-gpg-sign");
}

describe("remediation transaction safety", () => {
  it("refuses a stale plan before writing", async () => {
    const root = await copyFixture("autofix/vulnerable");
    const planned = await runRemediation({ path: root, dryRun: true });
    await appendFile(path.join(root, "app.py"), "\n# concurrent user edit\n", "utf8");
    const changed = await readFile(path.join(root, "app.py"), "utf8");
    const transaction = await executeSafeTransaction(
      root,
      planned.plans,
      transactionContext(root, planned),
    );
    expect(transaction.finalState).toBe("STALE_FINDING");
    expect(transaction.actualChanges).toEqual([]);
    expect(await readFile(path.join(root, "app.py"), "utf8")).toBe(changed);
  });

  it("preserves unrelated dirty work and refuses an affected dirty file", async () => {
    const root = await copyFixture("phase5/safe-multiple");
    await writeFile(path.join(root, "notes.txt"), "baseline\n", "utf8");
    initializeGit(root);
    await writeFile(path.join(root, "notes.txt"), "user work\n", "utf8");
    const result = await runRemediation({ path: root, applySafe: true });
    expect(result.transactions[0]?.finalState).toBe("APPLIED_VERIFIED");
    expect(await readFile(path.join(root, "notes.txt"), "utf8")).toBe("user work\n");

    const dirtyRoot = await copyFixture("autofix/vulnerable");
    initializeGit(dirtyRoot);
    await appendFile(
      path.join(dirtyRoot, "app.py"),
      "\n# unrelated edit in affected file\n",
      "utf8",
    );
    const before = await readFile(path.join(dirtyRoot, "app.py"), "utf8");
    const refused = await runRemediation({ path: dirtyRoot, applySafe: true });
    expect(refused.plans[0]?.state).toBe("REQUIRES_REVIEW");
    expect(refused.transactions).toEqual([]);
    expect(await readFile(path.join(dirtyRoot, "app.py"), "utf8")).toBe(before);
  });

  it("rolls back partial writes and explicit command verification failures", async () => {
    const partialRoot = await copyFixture("phase5/safe-multiple");
    const originalA = await readFile(path.join(partialRoot, "src", "session.ts"), "utf8");
    const originalB = await readFile(path.join(partialRoot, "src", "web.py"), "utf8");
    const partial = await runRemediation(
      { path: partialRoot, applySafe: true },
      {
        afterFileWrite(_path, completedWrites) {
          if (completedWrites === 1) throw new Error("synthetic interrupted write");
        },
      },
    );
    expect(partial.transactions[0]?.finalState).toBe("ROLLBACK_SUCCEEDED");
    expect(await readFile(path.join(partialRoot, "src", "session.ts"), "utf8")).toBe(originalA);
    expect(await readFile(path.join(partialRoot, "src", "web.py"), "utf8")).toBe(originalB);

    const verificationRoot = await copyFixture("autofix/vulnerable");
    const original = await readFile(path.join(verificationRoot, "app.py"), "utf8");
    const failed = await runRemediation({
      path: verificationRoot,
      applySafe: true,
      verificationCommands: [
        { executable: process.execPath, arguments: ["-e", "process.exit(9)"] },
      ],
    });
    expect(failed.transactions[0]?.finalState).toBe("ROLLBACK_SUCCEEDED");
    expect(failed.transactions[0]?.verificationResults).toContainEqual(
      expect.objectContaining({ stage: "TRUSTED_COMMAND", status: "FAILED" }),
    );
    expect(await readFile(path.join(verificationRoot, "app.py"), "utf8")).toBe(original);
  });

  it("rolls back when a security rescan still proves the original finding", async () => {
    const root = await copyFixture("autofix/vulnerable");
    const original = await readFile(path.join(root, "app.py"), "utf8");
    const before = await scanRepository({ path: root });
    const planned = await runRemediation({ path: root, dryRun: true });
    const transaction = await executeSafeTransaction(
      root,
      planned.plans,
      transactionContext(root, planned),
      [],
      {},
      { scan: () => Promise.resolve(before) },
    );
    expect(transaction.finalState).toBe("ROLLBACK_SUCCEEDED");
    expect(transaction.findingStateTransitions[0]?.result).toBe("UNRESOLVED");
    expect(await readFile(path.join(root, "app.py"), "utf8")).toBe(original);
  });

  it("rejects traversal and symlink replacement without touching outside data", async () => {
    const root = await copyFixture("autofix/vulnerable");
    const planned = await runRemediation({ path: root, dryRun: true });
    const plan = planned.plans[0];
    if (plan === undefined) throw new Error("expected plan");
    const escaped: RemediationCandidate = {
      ...plan,
      affectedFiles: ["../outside.py"],
      fileBaselines: plan.fileBaselines.map((file) => ({ ...file, path: "../outside.py" })),
      transformations: plan.transformations.map((item) => ({ ...item, path: "../outside.py" })),
    };
    const traversal = await executeSafeTransaction(
      root,
      [escaped],
      transactionContext(root, planned),
    );
    expect(traversal.finalState).toBe("VERIFICATION_FAILED");

    const parent = path.dirname(root);
    const outside = path.join(parent, "outside.py");
    await writeFile(outside, "outside-data\n", "utf8");
    await rm(path.join(root, "app.py"));
    try {
      await symlink(outside, path.join(root, "app.py"), "file");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    const symlinkResult = await executeSafeTransaction(
      root,
      planned.plans,
      transactionContext(root, planned),
    );
    expect(symlinkResult.finalState).toBe("VERIFICATION_FAILED");
    expect(await readFile(outside, "utf8")).toBe("outside-data\n");
  });

  it("does not execute hostile repository scripts, formatters, hooks, or instructions", async () => {
    const root = await copyFixture("phase5/hostile");
    initializeGit(root);
    const hook = path.join(root, ".git", "hooks", "post-index-change");
    await writeFile(hook, "#!/bin/sh\ntouch git-hook-executed\n", "utf8");
    await chmod(hook, 0o755);
    const result = await runRemediation({ path: root, applySafe: true });
    expect(result.transactions[0]?.finalState).toBe("APPLIED_VERIFIED");
    for (const marker of [
      "repository-script-executed",
      "formatter-executed",
      "formatter-config-executed",
      "git-hook-executed",
    ]) {
      await expect(readFile(path.join(root, marker), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    }
  });

  it("handles a Unicode target and safely ignores an oversized crafted source", async () => {
    const unicodeRoot = await temporaryDirectory("invariantsec-unicode-");
    const unicodePath = path.join(unicodeRoot, "session-μ.py");
    await writeFile(
      unicodePath,
      'from flask import Flask\napp = Flask(__name__)\napp.config["SESSION_COOKIE_HTTPONLY"] = False\n',
      "utf8",
    );
    const unicode = await runRemediation({ path: unicodeRoot, applySafe: true });
    expect(unicode.transactions[0]?.finalState).toBe("APPLIED_VERIFIED");
    expect(await readFile(unicodePath, "utf8")).toContain("= True");

    const hugeRoot = await temporaryDirectory("invariantsec-huge-");
    const huge = `${"#".repeat(1_100_000)}\napp.config["SESSION_COOKIE_HTTPONLY"] = False\n`;
    await writeFile(path.join(hugeRoot, "app.py"), huge, "utf8");
    const skipped = await runRemediation({ path: hugeRoot, applySafe: true });
    expect(skipped.plans).toEqual([]);
    expect(await readFile(path.join(hugeRoot, "app.py"), "utf8")).toBe(huge);
  });

  it("preserves CRLF line endings, final newline, and file mode where supported", async () => {
    const root = await temporaryDirectory("invariantsec-attributes-");
    const target = path.join(root, "app.py");
    const original =
      'from flask import Flask\r\napp = Flask(__name__)\r\napp.config["SESSION_COOKIE_HTTPONLY"] = False\r\n';
    await writeFile(target, original, { encoding: "utf8", mode: 0o744 });
    const result = await runRemediation({ path: root, applySafe: true });
    expect(result.transactions[0]?.finalState).toBe("APPLIED_VERIFIED");
    const updated = await readFile(target, "utf8");
    expect(updated.endsWith("\r\n")).toBe(true);
    expect(updated.replaceAll("\r\n", "")).not.toContain("\n");
    expect(updated).toContain("= True");
    if (process.platform !== "win32") {
      const { mode } = await import("node:fs/promises").then(({ stat }) => stat(target));
      expect(mode & 0o777).toBe(0o744);
    }
  });
});
