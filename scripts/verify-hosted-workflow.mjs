import { spawnSync } from "node:child_process";
import path from "node:path";

const workflow = process.argv[2];
if (workflow === undefined) throw new Error("Workflow filename is required.");
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const commit = process.env.GITHUB_SHA;
if (repository === undefined || token === undefined || commit === undefined)
  throw new Error("GitHub repository, token, and commit context are required.");
if (!/^[a-f0-9]{40}$/u.test(commit)) throw new Error("GITHUB_SHA is not a full commit SHA.");

const response = await fetch(
  `https://api.github.com/repos/${repository}/actions/workflows/${workflow}/runs?head_sha=${commit}&status=completed&per_page=20`,
  {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "vibeshield-release-gate",
      "X-GitHub-Api-Version": "2026-03-10",
    },
    signal: AbortSignal.timeout(30_000),
  },
);
if (!response.ok) throw new Error(`GitHub workflow query failed with HTTP ${response.status}.`);
const payload = await response.json();
const matching = payload.workflow_runs?.filter(
  (run) =>
    run.head_sha === commit &&
    run.head_branch === "main" &&
    run.event === "push" &&
    run.status === "completed" &&
    run.conclusion === "success",
);
if (!Array.isArray(matching) || matching.length === 0)
  throw new Error(`${workflow} has no successful main push run for ${commit}.`);

const root = path.resolve(".");
const ancestor = spawnSync(
  "git",
  [
    "-c",
    `safe.directory=${root.replaceAll("\\", "/")}`,
    "merge-base",
    "--is-ancestor",
    commit,
    "origin/main",
  ],
  {
    cwd: root,
    shell: false,
    windowsHide: true,
    timeout: 30_000,
    env: {
      PATH: process.env.PATH,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
      GIT_TERMINAL_PROMPT: "0",
    },
  },
);
if (ancestor.error !== undefined || ancestor.status !== 0)
  throw new Error("Tagged commit is not reachable from origin/main.");
process.stdout.write(
  `Verified ${workflow} run ${matching[0].id} for exact main commit ${commit}.\n`,
);
