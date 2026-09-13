import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

// Read-only public API evidence: never dispatch, push, publish, or use credentials.
const repository = "shakeriamin21/cydetix";
const sourceCommit = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  windowsHide: true,
}).stdout.trim();
if (!/^[a-f0-9]{40}$/u.test(sourceCommit)) throw new Error("Invalid HEAD");
const base = `https://api.github.com/repos/${repository}`;
const endpoints = {
  repository: base,
  commit: `${base}/commits/${sourceCommit}`,
  status: `${base}/commits/${sourceCommit}/status`,
  checkRuns: `${base}/commits/${sourceCommit}/check-runs?per_page=100`,
  workflowRuns: `${base}/actions/runs?head_sha=${sourceCommit}&per_page=100`,
  offendingCommit: `${base}/commits/d8b3d5a10f4c878c413a388d6f640fa390cb4b5b`,
};
const results = {};
for (const [id, url] of Object.entries(endpoints)) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Cydetix-alpha12-readonly-validation",
      },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.json();
    results[id] = {
      url,
      status: response.status,
      pagination: response.headers.get("link"),
      ...(response.ok
        ? id === "repository"
          ? { fullName: body.full_name, defaultBranch: body.default_branch }
          : id === "commit" || id === "offendingCommit"
            ? {
                sha: body.sha,
                url: body.html_url,
                authorLogin: body.author?.login ?? null,
                committerLogin: body.committer?.login ?? null,
                verification: body.commit?.verification
                  ? {
                      verified: body.commit.verification.verified,
                      reason: body.commit.verification.reason,
                    }
                  : null,
              }
            : id === "status"
              ? {
                  state: body.state,
                  totalCount: body.total_count,
                  statuses: body.statuses.map((s) => ({
                    context: s.context,
                    state: s.state,
                    targetUrl: s.target_url,
                  })),
                }
              : id === "checkRuns"
                ? {
                    totalCount: body.total_count,
                    checks: body.check_runs.map((c) => ({
                      name: c.name,
                      status: c.status,
                      conclusion: c.conclusion,
                      headSha: c.head_sha,
                      url: c.html_url,
                    })),
                  }
                : {
                    totalCount: body.total_count,
                    runs: body.workflow_runs.map((r) => ({
                      id: r.id,
                      name: r.name,
                      event: r.event,
                      headSha: r.head_sha,
                      headBranch: r.head_branch,
                      status: r.status,
                      conclusion: r.conclusion,
                      url: r.html_url,
                    })),
                  }
        : { message: body.message ?? "HTTP failure" }),
    };
  } catch (error) {
    results[id] = { url, status: null, error: error.cause?.code ?? error.name };
  }
  process.stdout.write(`${id}: ${results[id].status ?? results[id].error}\n`);
}
const evidence = {
  schemaVersion: "1.0.0",
  sourceCommit,
  repository,
  observedAt: new Date().toISOString(),
  method: "Unauthenticated, read-only GitHub REST requests. No dispatch, push or release action.",
  results,
  conclusion:
    results.repository.status === 200 &&
    (results.commit.status === 404 ||
      (results.commit.status === 422 &&
        results.commit.message === `No commit found for SHA: ${sourceCommit}`))
      ? "EXACT_COMMIT_NOT_ON_REMOTE"
      : "REQUIRES_CHECK_REVIEW",
  limitations: [
    "HTTP errors and authentication failures are not passing checks. Pagination, if present, prevents a complete check inventory.",
    "Local passing gates and historical release checks do not establish exact-commit hosted validation.",
  ],
};
await mkdir("validation/alpha12/closure", { recursive: true });
await writeFile(
  process.argv.includes("--final-head")
    ? ".cydetix/alpha12/closure/final-head-hosted-checks.json"
    : "validation/alpha12/closure/hosted-checks.json",
  `${JSON.stringify(evidence, null, 2)}\n`,
);
