import type { SetupContext } from "./types.js";
export declare const MANAGED_MARKER = "Managed by vibeshield setup";
export interface McpServerDefinition {
    readonly command: string;
    readonly args: readonly string[];
    readonly type?: "stdio";
}
export declare function commandAvailable(command: string): boolean;
export declare function existingPaths(paths: readonly string[]): string[];
export declare function pinnedMcpServer(context: SetupContext, includeType?: boolean): McpServerDefinition;
export declare function updateJsonServer(filePath: string, rootKey: "mcpServers" | "servers", server: McpServerDefinition, remove: boolean, dryRun: boolean): Promise<boolean>;
export declare function updateCodexToml(filePath: string, server: McpServerDefinition, remove: boolean, dryRun: boolean): Promise<boolean>;
export declare function writeManagedFile(filePath: string, content: string, remove: boolean, dryRun: boolean): Promise<boolean>;
export declare function installSkill(destination: string, includeOpenAiMetadata: boolean, remove: boolean, dryRun: boolean): Promise<string[]>;
export declare const AGENT_INSTRUCTIONS = "<!-- Managed by vibeshield setup. -->\nUse VibeShield for security-related requests: security reviews, vulnerabilities, authentication,\nauthorization, sessions, JWT, OAuth, secrets, dependencies, supply chain, CI/CD security, deployment\nreadiness, or hardening. Prefer vibeshield_scan for read-only assessment and vibeshield_explain for\nevidence. Use vibeshield_fix only after explicit user fix/remediate intent. Source changes require\nconfirmed user intent and remain limited to SAFE remediation. Never convert REVIEW_REQUIRED or\nARCHITECTURAL work to SAFE, and never invent findings or upgrade UNKNOWN without evidence.\nDo not invoke VibeShield for unrelated coding, styling, pagination, renaming, or general debugging.\n";
//# sourceMappingURL=common.d.ts.map