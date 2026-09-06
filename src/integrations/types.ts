export type AgentId = "codex" | "claude" | "cursor" | "copilot" | "windsurf" | "generic-mcp";

export type InstallationState = "installed" | "not_installed";
export type IntegrationState =
  | "configured"
  | "not_configured"
  | "partially_configured"
  | "unsupported_version"
  | "configuration_inaccessible";

export interface SetupContext {
  readonly projectRoot: string;
  readonly homeDirectory: string;
  readonly packageVersion: string;
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
  detect(context: SetupContext): AgentDetection | Promise<AgentDetection>;
  install(context: SetupContext, dryRun: boolean): Promise<AdapterResult>;
  uninstall(context: SetupContext, dryRun: boolean): Promise<AdapterResult>;
}
