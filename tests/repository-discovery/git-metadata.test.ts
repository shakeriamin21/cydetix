import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { inspectGitMetadata } from "../../src/repository-discovery/git-metadata.js";
import { temporaryDirectory } from "../helpers/temporary.js";

function git(root: string, ...arguments_: string[]): void {
  const result = spawnSync("git", arguments_, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error(result.stderr);
}

describe("bounded Git metadata", () => {
  it("reports clean/dirty state without executing a configured fsmonitor hook", async () => {
    const temporary = await temporaryDirectory("cydetix-git-metadata-");
    const repository = path.join(temporary, "repo");
    const hook = path.join(temporary, "hostile-fsmonitor.mjs");
    const marker = path.join(temporary, "fsmonitor-executed");
    await mkdir(repository);
    await writeFile(path.join(repository, "app.ts"), "export const value = 1;\n", "utf8");
    await writeFile(
      hook,
      `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(marker)}, "executed");\n`,
      "utf8",
    );
    git(repository, "init", "--quiet");
    git(repository, "add", "app.ts");
    git(
      repository,
      "-c",
      "user.name=Cydetix test",
      "-c",
      "user.email=cydetix@example.invalid",
      "commit",
      "--quiet",
      "--no-gpg-sign",
      "-m",
      "fixture",
    );
    git(repository, "config", "core.fsmonitor", `"${process.execPath}" "${hook}"`);

    const clean = await inspectGitMetadata(repository);
    expect(clean.workingTreeState).toBe("CLEAN");
    expect(clean.commit).toMatch(/^[a-f0-9]{40}$/u);
    expect(existsSync(marker)).toBe(false);

    await writeFile(path.join(repository, "app.ts"), "export const value = 2;\n", "utf8");
    const dirty = await inspectGitMetadata(repository);
    expect(dirty.workingTreeState).toBe("DIRTY");
    expect(existsSync(marker)).toBe(false);
  });
});
