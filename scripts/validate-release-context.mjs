import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
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
      timeout: 30_000,
      maxBuffer: 1_000_000,
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
    throw new Error(`Release context check failed while running git ${arguments_[0] ?? ""}.`);
  return result.stdout.trim();
}

const tag = process.env.CYDETIX_EXPECTED_TAG;
if (tag === undefined) throw new Error("CYDETIX_EXPECTED_TAG is required.");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const plugin = JSON.parse(await readFile("plugins/cydetix/.codex-plugin/plugin.json", "utf8"));
const expectedTag = `v${packageJson.version}`;
if (tag !== expectedTag) throw new Error(`Tag ${tag} does not match ${expectedTag}.`);
if (plugin.version !== packageJson.version)
  throw new Error("Plugin version does not match package.");
const tagType = git(["cat-file", "-t", `refs/tags/${tag}`]);
if (tagType !== "tag") throw new Error("Release tag must be annotated, not lightweight.");
const taggedCommit = git(["rev-parse", `refs/tags/${tag}^{commit}`]);
const head = git(["rev-parse", "HEAD"]);
if (taggedCommit !== head) throw new Error("Release tag does not point at checked-out HEAD.");
if (git(["status", "--porcelain"]) !== "") throw new Error("Tracked release worktree is dirty.");
const changelog = await readFile("CHANGELOG.md", "utf8");
if (!changelog.includes(`## [${packageJson.version}]`))
  throw new Error("Changelog has no exact release heading.");
await readFile(`docs/releases/v${packageJson.version}.md`, "utf8");
process.stdout.write(`Validated annotated ${tag} at ${head}.\n`);
