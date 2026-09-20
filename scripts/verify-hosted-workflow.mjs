import { spawnSync } from "node:child_process";
import path from "node:path";

import { requireSuccessfulExactCommitWorkflowRun } from "../dist/validation/hosted-workflow.js";
import { completeEvidence, establishEvidenceSource } from "./lib/source-bound-evidence.mjs";

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
      "User-Agent": "cydetix-release-gate",
      "X-GitHub-Api-Version": "2026-03-10",
    },
    signal: AbortSignal.timeout(30_000),
  },
);
if (!response.ok) throw new Error(`GitHub workflow query failed with HTTP ${response.status}.`);
const payload = await response.json();
const matching = requireSuccessfulExactCommitWorkflowRun(payload, workflow, commit);
const source = await establishEvidenceSource(commit);
if (source.repository !== repository)
  throw new Error("GitHub repository does not match the checked-out package repository.");
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

const workflowEvidenceTypes = new Map([
  ["ci.yml", "hosted-ci"],
  ["codeql.yml", "codeql"],
  ["scorecard.yml", "openssf-scorecard"],
]);
const evidenceType = workflowEvidenceTypes.get(workflow);
if (evidenceType === undefined) throw new Error(`Unsupported hosted workflow ${workflow}.`);
let jobs = [];
if (workflow === "ci.yml") {
  const jobsResponse = await fetch(
    `https://api.github.com/repos/${repository}/actions/runs/${matching.id}/jobs?per_page=100`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "cydetix-release-gate",
        "X-GitHub-Api-Version": "2026-03-10",
      },
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!jobsResponse.ok)
    throw new Error(`GitHub jobs query failed with HTTP ${jobsResponse.status}.`);
  const jobsPayload = await jobsResponse.json();
  jobs = Array.isArray(jobsPayload.jobs) ? jobsPayload.jobs : [];
  const requiredJobs = [
    "action-smoke",
    "verify (windows-latest, 22.18.0)",
    "verify (windows-latest, 24.11.0)",
    "verify (ubuntu-latest, 22.18.0)",
    "verify (ubuntu-latest, 24.11.0)",
    "verify (macos-latest, 22.18.0)",
    "verify (macos-latest, 24.11.0)",
    "Hosted Linux container sandbox",
  ];
  for (const name of requiredJobs) {
    const job = jobs.find((candidate) => candidate?.name === name);
    if (job?.conclusion !== "success")
      throw new Error(`CI run ${matching.id} lacks successful mandatory job ${name}.`);
  }
}
await completeEvidence(
  source,
  {
    evidenceType,
    producer: { name: "verify-hosted-workflow", version: "1.0.0" },
    result: "PASS",
    details: {
      workflow,
      runId: matching.id,
      headSha: matching.head_sha,
      headBranch: matching.head_branch,
      event: matching.event,
      conclusion: matching.conclusion,
      jobs: jobs.map((job) => ({ id: job.id, name: job.name, conclusion: job.conclusion })),
    },
  },
  path.resolve(".cydetix", "evidence", "bound", `${evidenceType}.json`),
);
if (workflow === "ci.yml") {
  const sandbox = jobs.find((job) => job?.name === "Hosted Linux container sandbox");
  await completeEvidence(
    source,
    {
      evidenceType: "hosted-sandbox",
      producer: { name: "verify-hosted-workflow", version: "1.0.0" },
      result: "PASS",
      details: { workflow, runId: matching.id, jobId: sandbox.id, jobName: sandbox.name },
    },
    path.resolve(".cydetix", "evidence", "bound", "hosted-sandbox.json"),
  );
}

process.stdout.write(`Verified ${workflow} run ${matching.id} for exact main commit ${commit}.\n`);
