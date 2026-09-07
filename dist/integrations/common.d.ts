import type { IntegrationState, SetupContext, TrustedIntegrationRoot } from "./types.js";
export declare const MANAGED_MARKER = "Managed by cydetix setup";
export interface McpServerDefinition {
    readonly command: string;
    readonly args: readonly string[];
    readonly type?: "stdio";
}
export declare function createTrustedIntegrationRoot(inputRoot: string): Promise<TrustedIntegrationRoot>;
export declare function resolveTrustedIntegrationPath(boundary: TrustedIntegrationRoot, filePath: string): string;
export declare function commandAvailable(command: string, platform?: NodeJS.Platform, executablePath?: string): boolean;
export declare function existingPaths(paths: readonly string[]): string[];
export declare function pinnedMcpServer(context: Pick<SetupContext, "packageVersion" | "platform">, includeType?: boolean): McpServerDefinition;
export declare function readRegularFile(boundary: TrustedIntegrationRoot, filePath: string): Promise<string | undefined>;
export declare function atomicValidatedWrite(boundary: TrustedIntegrationRoot, filePath: string, content: string, validate: (writtenPath: string, transientBackup: string | undefined) => void | Promise<void>): Promise<void>;
export declare function inspectJsonServer(boundary: TrustedIntegrationRoot, filePath: string, rootKey: "mcpServers" | "servers", expected: McpServerDefinition): Promise<IntegrationState>;
export declare function updateJsonServer(boundary: TrustedIntegrationRoot, filePath: string, rootKey: "mcpServers" | "servers", server: McpServerDefinition, remove: boolean, dryRun: boolean): Promise<boolean>;
export declare function inspectCodexToml(boundary: TrustedIntegrationRoot, filePath: string, server: McpServerDefinition): Promise<IntegrationState>;
export declare function updateCodexToml(boundary: TrustedIntegrationRoot, filePath: string, server: McpServerDefinition, remove: boolean, dryRun: boolean): Promise<boolean>;
export declare function inspectManagedFile(boundary: TrustedIntegrationRoot, filePath: string): Promise<IntegrationState>;
export declare function writeManagedFile(boundary: TrustedIntegrationRoot, filePath: string, content: string, remove: boolean, dryRun: boolean): Promise<boolean>;
export declare function installSkill(boundary: TrustedIntegrationRoot, destination: string, includeOpenAiMetadata: boolean, remove: boolean, dryRun: boolean): Promise<string[]>;
export declare function combineIntegrationStates(states: readonly IntegrationState[]): IntegrationState;
export declare function agentInstructions(version: string): string;
//# sourceMappingURL=common.d.ts.map