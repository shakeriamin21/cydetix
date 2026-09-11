import { spawnSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

export interface PassiveGitMetadata {
  readonly commit: string | null;
  readonly workingTreeState: "CLEAN" | "DIRTY" | "UNKNOWN" | "NOT_A_GIT_REPOSITORY";
  readonly limitation: string;
}

async function regularTextFile(filePath: string, maxBytes: number): Promise<string | undefined> {
  const stat = await lstat(filePath).catch(() => undefined);
  if (stat === undefined || !stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) {
    return undefined;
  }
  return readFile(filePath, "utf8").catch(() => undefined);
}

function inspectWorkingTree(root: string): "CLEAN" | "DIRTY" | "UNKNOWN" {
  const hooksPath = process.platform === "win32" ? "NUL" : "/dev/null";
  const result = spawnSync(
    "git",
    [
      "--no-optional-locks",
      "-c",
      `safe.directory=${root.replaceAll("\\", "/")}`,
      "-c",
      "core.fsmonitor=false",
      "-c",
      "core.untrackedCache=false",
      "-c",
      `core.hooksPath=${hooksPath}`,
      "-c",
      "status.submoduleSummary=false",
      "status",
      "--porcelain=v1",
      "--untracked-files=normal",
      "--ignore-submodules=all",
    ],
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 5_000,
      maxBuffer: 1_048_576,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        PATHEXT: process.env.PATHEXT,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
        GIT_TERMINAL_PROMPT: "0",
        GIT_PAGER: "cat",
        GIT_OPTIONAL_LOCKS: "0",
      },
    },
  );
  if (result.error !== undefined || result.status !== 0) return "UNKNOWN";
  return result.stdout.trim() === "" ? "CLEAN" : "DIRTY";
}

export async function inspectGitMetadata(root: string): Promise<PassiveGitMetadata> {
  const gitDirectory = path.join(root, ".git");
  const stat = await lstat(gitDirectory).catch(() => undefined);
  if (stat === undefined || !stat.isDirectory() || stat.isSymbolicLink()) {
    return {
      commit: null,
      workingTreeState: "NOT_A_GIT_REPOSITORY",
      limitation:
        "No regular repository-local .git directory was available for passive metadata inspection.",
    };
  }
  const head = (await regularTextFile(path.join(gitDirectory, "HEAD"), 4096))?.trim();
  if (head === undefined) {
    return {
      commit: null,
      workingTreeState: "UNKNOWN",
      limitation:
        "Git HEAD could not be read passively; no Git command or repository hook was executed.",
    };
  }
  let commit: string | undefined;
  if (/^[a-f0-9]{40}$/.test(head)) commit = head;
  else if (/^ref: refs\/[A-Za-z0-9._/-]+$/.test(head)) {
    const reference = head.slice("ref: ".length);
    commit = (
      await regularTextFile(path.join(gitDirectory, ...reference.split("/")), 4096)
    )?.trim();
    if (commit === undefined) {
      const packed = await regularTextFile(path.join(gitDirectory, "packed-refs"), 4_194_304);
      commit = packed
        ?.split(/\r?\n/)
        .map((line) => line.trim().split(/\s+/, 2))
        .find((parts) => parts[1] === reference)?.[0];
    }
  }
  const workingTreeState = inspectWorkingTree(root);
  return {
    commit: commit !== undefined && /^[a-f0-9]{40}$/.test(commit) ? commit : null,
    workingTreeState,
    limitation:
      workingTreeState === "UNKNOWN"
        ? "Working-tree cleanliness is UNKNOWN because the bounded hook-disabled Git probe was unavailable, exceeded five seconds/one MiB, or failed safely."
        : "Working-tree state was obtained with a five-second/one-MiB no-lock Git status probe; repository hooks/fsmonitor and submodule inspection were disabled.",
  };
}
