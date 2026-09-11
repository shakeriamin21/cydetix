export interface PassiveGitMetadata {
    readonly commit: string | null;
    readonly workingTreeState: "UNKNOWN" | "NOT_A_GIT_REPOSITORY";
    readonly limitation: string;
}
export declare function inspectPassiveGitMetadata(root: string): Promise<PassiveGitMetadata>;
//# sourceMappingURL=git-metadata.d.ts.map