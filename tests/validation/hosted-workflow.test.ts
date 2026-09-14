import { describe, expect, it } from "vitest";

import { requireSuccessfulExactCommitWorkflowRun } from "../../src/validation/hosted-workflow.js";

const commit = "a".repeat(40);
const workflow = "codeql.yml";

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    head_sha: commit,
    head_branch: "main",
    event: "push",
    status: "completed",
    conclusion: "success",
    ...overrides,
  };
}

describe("exact-commit CodeQL release gate", () => {
  it("accepts exact-commit CodeQL success", () => {
    expect(
      requireSuccessfulExactCommitWorkflowRun({ workflow_runs: [run()] }, workflow, commit).id,
    ).toBe(42);
  });

  it("rejects an absent CodeQL run", () => {
    expect(() =>
      requireSuccessfulExactCommitWorkflowRun({ workflow_runs: [] }, workflow, commit),
    ).toThrow(`codeql.yml has no successful main push run for ${commit}`);
  });

  it("rejects a successful CodeQL run for the wrong SHA", () => {
    expect(() =>
      requireSuccessfulExactCommitWorkflowRun(
        { workflow_runs: [run({ head_sha: "b".repeat(40) })] },
        workflow,
        commit,
      ),
    ).toThrow(`codeql.yml has no successful main push run for ${commit}`);
  });

  it.each(["failure", "cancelled", "skipped"])("rejects a %s CodeQL run", (conclusion) => {
    expect(() =>
      requireSuccessfulExactCommitWorkflowRun(
        { workflow_runs: [run({ conclusion })] },
        workflow,
        commit,
      ),
    ).toThrow(`codeql.yml has no successful main push run for ${commit}`);
  });
});
