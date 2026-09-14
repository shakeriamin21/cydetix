export interface HostedWorkflowRun {
  id: number;
  head_sha: string;
  head_branch: string;
  event: string;
  status: string;
  conclusion: string | null;
}

function isHostedWorkflowRun(value: unknown): value is HostedWorkflowRun {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "number" &&
    typeof candidate.head_sha === "string" &&
    typeof candidate.head_branch === "string" &&
    typeof candidate.event === "string" &&
    typeof candidate.status === "string" &&
    (typeof candidate.conclusion === "string" || candidate.conclusion === null)
  );
}

export function requireSuccessfulExactCommitWorkflowRun(
  payload: unknown,
  workflow: string,
  commit: string,
): HostedWorkflowRun {
  const runs =
    typeof payload === "object" && payload !== null && "workflow_runs" in payload
      ? (payload as { workflow_runs?: unknown }).workflow_runs
      : undefined;
  const matching = Array.isArray(runs)
    ? runs.filter(
        (run): run is HostedWorkflowRun =>
          isHostedWorkflowRun(run) &&
          run.head_sha === commit &&
          run.head_branch === "main" &&
          run.event === "push" &&
          run.status === "completed" &&
          run.conclusion === "success",
      )
    : [];
  const match = matching[0];
  if (match === undefined)
    throw new Error(`${workflow} has no successful main push run for ${commit}.`);
  return match;
}
