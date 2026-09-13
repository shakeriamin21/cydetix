import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Explicit acquisition step. The scan runner never downloads or executes target content.
const manifest = JSON.parse(await readFile("validation/alpha12/corpus-manifest.json", "utf8"));
const cache = path.resolve(".cydetix/alpha12/corpora");
const historicalCache = path.join(tmpdir(), "cydetix-alpha8-external-corpus-20260911");
const nullDevice = process.platform === "win32" ? "NUL" : "/dev/null";
const locations = {};

function git(root, args) {
  const result = spawnSync(
    "git",
    [
      "-C",
      root,
      "-c",
      `safe.directory=${root.replaceAll("\\", "/")}`,
      "-c",
      `core.hooksPath=${nullDevice}`,
      "-c",
      "core.autocrlf=false",
      "-c",
      "credential.helper=",
      ...args,
    ],
    {
      shell: false,
      windowsHide: true,
      encoding: "utf8",
      timeout: 180_000,
      maxBuffer: 2_000_000,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        PATHEXT: process.env.PATHEXT,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: nullDevice,
        GIT_TERMINAL_PROMPT: "0",
        GIT_LFS_SKIP_SMUDGE: "1",
      },
    },
  );
  if (result.error || result.status !== 0)
    throw new Error(`Corpus Git ${args[0]} failed: ${result.error?.message ?? result.stderr}`);
  return result.stdout.trim();
}

for (const target of manifest.targets) {
  if (
    !/^[a-z0-9-]+$/u.test(target.id) ||
    !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/u.test(target.repository) ||
    !/^[a-f0-9]{40}$/u.test(target.commit)
  )
    throw new Error("Invalid pinned corpus identity.");
  const previous =
    target.id === "nextjs-auth"
      ? path.resolve(".cydetix/corpora/batch2-nextjs-postgres-auth-starter")
      : path.join(historicalCache, target.id);
  const reusable =
    existsSync(path.join(previous, ".git")) &&
    git(previous, ["rev-parse", "HEAD"]) === target.commit &&
    git(previous, ["status", "--porcelain", "--untracked-files=all"]) === "";
  const root = reusable ? previous : path.join(cache, target.id);
  if (!existsSync(path.join(root, ".git"))) {
    await mkdir(root, { recursive: true });
    git(root, ["init", "--template="]);
    git(root, ["remote", "add", "origin", `https://github.com/${target.repository}.git`]);
  }
  if (!reusable && !existsSync(path.join(root, ".git", "cydetix-pinned"))) {
    git(root, ["fetch", "--depth=1", "origin", target.commit]);
    git(root, ["checkout", "--detach", target.commit]);
    await writeFile(path.join(root, ".git", "cydetix-pinned"), target.commit);
  }
  if (git(root, ["rev-parse", "HEAD"]) !== target.commit)
    throw new Error(`Wrong revision: ${target.id}`);
  if (git(root, ["status", "--porcelain", "--untracked-files=all"]) !== "")
    throw new Error(`Dirty corpus: ${target.id}`);
  locations[target.id] = root;
  process.stdout.write(`Verified ${target.repository}@${target.commit}\n`);
}
await mkdir(path.dirname(cache), { recursive: true });
await writeFile(".cydetix/alpha12/corpus-paths.json", `${JSON.stringify(locations, null, 2)}\n`);
