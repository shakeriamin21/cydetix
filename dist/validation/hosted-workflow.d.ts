export interface HostedWorkflowRun {
    id: number;
    head_sha: string;
    head_branch: string;
    event: string;
    status: string;
    conclusion: string | null;
}
export declare function requireSuccessfulExactCommitWorkflowRun(payload: unknown, workflow: string, commit: string): HostedWorkflowRun;
//# sourceMappingURL=hosted-workflow.d.ts.map