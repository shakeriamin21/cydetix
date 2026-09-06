export type AgentId = "codex" | "claude" | "cursor" | "copilot" | "windsurf" | "generic-mcp";
export interface SetupContext {
    readonly projectRoot: string;
    readonly homeDirectory: string;
    readonly packageVersion: string;
    readonly platform: NodeJS.Platform;
}
export interface AgentDetection {
    readonly id: AgentId;
    readonly displayName: string;
    readonly detected: boolean;
    readonly evidence: readonly string[];
}
export interface AdapterResult {
    readonly id: AgentId;
    readonly displayName: string;
    readonly files: readonly string[];
    readonly action: "installed" | "removed" | "unchanged";
}
export interface IntegrationAdapter {
    readonly id: AgentId;
    readonly displayName: string;
    detect(context: SetupContext): AgentDetection | Promise<AgentDetection>;
    install(context: SetupContext, dryRun: boolean): Promise<AdapterResult>;
    uninstall(context: SetupContext, dryRun: boolean): Promise<AdapterResult>;
}
//# sourceMappingURL=types.d.ts.map