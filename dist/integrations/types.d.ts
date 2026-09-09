export type AgentId = "codex" | "claude" | "cursor" | "copilot" | "windsurf" | "gemini" | "cline" | "roo" | "continue" | "goose" | "generic-mcp";
export type CompatibilityTier = "tier-1-native-mcp" | "tier-2-deterministic-cli" | "tier-3-ci-report";
export interface AgentCapabilities {
    readonly mcpStdio: boolean;
    readonly mcpHttp: boolean;
    readonly projectScopedConfig: boolean;
    readonly userScopedConfig: boolean;
    readonly skills: boolean;
    readonly instructionFiles: boolean;
}
export interface CompatibilityTierDefinition {
    readonly id: CompatibilityTier;
    readonly level: 1 | 2 | 3;
    readonly displayName: string;
    readonly description: string;
}
export declare const COMPATIBILITY_TIERS: readonly CompatibilityTierDefinition[];
export type InstallationState = "installed" | "not_installed";
export type IntegrationState = "configured" | "not_configured" | "partially_configured" | "unsupported_version" | "configuration_inaccessible";
export interface TrustedIntegrationRoot {
    /** Absolute path supplied by the trusted setup caller. */
    readonly requestedRoot: string;
    /** One-time canonical identity used for all integration filesystem access. */
    readonly root: string;
}
export interface PersistentRuntime {
    readonly packageRoot: string;
    readonly packageJsonPath: string;
    readonly entrypoint: string;
    readonly nodeExecutable: string;
    readonly version: string;
    readonly source: "project-local" | "current-installation";
}
export interface SetupContext {
    readonly projectRoot: string;
    readonly homeDirectory: string;
    readonly projectBoundary: TrustedIntegrationRoot;
    readonly homeBoundary: TrustedIntegrationRoot;
    readonly packageVersion: string;
    readonly runtime: PersistentRuntime;
    readonly platform: NodeJS.Platform;
    readonly executablePath: string;
}
export interface AgentDetection {
    readonly id: AgentId;
    readonly displayName: string;
    readonly detected: boolean;
    readonly installation: InstallationState;
    readonly integration: IntegrationState;
    readonly evidence: readonly string[];
}
export interface AdapterResult {
    readonly id: AgentId;
    readonly displayName: string;
    readonly files: readonly string[];
    readonly action: "installed" | "updated" | "removed" | "unchanged";
    readonly verified: boolean;
}
export interface IntegrationAdapter {
    readonly id: AgentId;
    readonly displayName: string;
    readonly compatibilityTier: CompatibilityTier;
    readonly capabilities: AgentCapabilities;
    configTargets(context: SetupContext): readonly string[];
    detect(context: SetupContext): AgentDetection | Promise<AgentDetection>;
    install(context: SetupContext, dryRun: boolean): Promise<AdapterResult>;
    verify(context: SetupContext): boolean | Promise<boolean>;
    remove(context: SetupContext, dryRun: boolean): Promise<AdapterResult>;
}
//# sourceMappingURL=types.d.ts.map