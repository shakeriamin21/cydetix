function isHostedWorkflowRun(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const candidate = value;
    return (typeof candidate.id === "number" &&
        typeof candidate.head_sha === "string" &&
        typeof candidate.head_branch === "string" &&
        typeof candidate.event === "string" &&
        typeof candidate.status === "string" &&
        (typeof candidate.conclusion === "string" || candidate.conclusion === null));
}
export function requireSuccessfulExactCommitWorkflowRun(payload, workflow, commit) {
    const runs = typeof payload === "object" && payload !== null && "workflow_runs" in payload
        ? payload.workflow_runs
        : undefined;
    const matching = Array.isArray(runs)
        ? runs.filter((run) => isHostedWorkflowRun(run) &&
            run.head_sha === commit &&
            run.head_branch === "main" &&
            run.event === "push" &&
            run.status === "completed" &&
            run.conclusion === "success")
        : [];
    const match = matching[0];
    if (match === undefined)
        throw new Error(`${workflow} has no successful main push run for ${commit}.`);
    return match;
}
//# sourceMappingURL=hosted-workflow.js.map