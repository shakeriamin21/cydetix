import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { establishEvidenceSource } from "../../scripts/lib/source-bound-evidence.mjs";
import { temporaryDirectory } from "../helpers/temporary.js";

function git(root: string, ...arguments_: string[]): string {
  const result = spawnSync("git", arguments_, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    },
  });
  if (result.error !== undefined || result.status !== 0)
    throw result.error ?? new Error(result.stderr);
  return result.stdout.trim();
}

async function repository() {
  const root = await temporaryDirectory("cydetix-evidence-producer-");
  git(root, "init");
  git(root, "config", "user.name", "Evidence Test");
  git(root, "config", "user.email", "evidence@example.invalid");
  await writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify({ repository: { url: "git+https://github.com/shakeriamin21/cydetix.git" } })}\n`,
  );
  await writeFile(path.join(root, "tracked.txt"), "clean\n");
  git(root, "add", "package.json", "tracked.txt");
  git(root, "commit", "-m", "fixture");
  return root;
}

describe("source-bound evidence producer identity", () => {
  it("derives repository and source identity from a clean checkout", async () => {
    const root = await repository();
    const head = git(root, "rev-parse", "HEAD");
    await expect(establishEvidenceSource(head, root)).resolves.toMatchObject({
      repository: "shakeriamin21/cydetix",
      sourceCommit: head,
    });
  });

  it("refuses a producer HEAD mismatch", async () => {
    const root = await repository();
    await expect(establishEvidenceSource("a".repeat(40), root)).rejects.toThrow(
      "Evidence producer HEAD mismatch",
    );
  });

  it("refuses dirty tracked source", async () => {
    const root = await repository();
    const head = git(root, "rev-parse", "HEAD");
    await writeFile(path.join(root, "tracked.txt"), "dirty\n");
    await expect(establishEvidenceSource(head, root)).rejects.toThrow("clean tracked source tree");
  });
});
