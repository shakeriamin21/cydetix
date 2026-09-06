import type { IntegrationState, SetupContext } from "./types.js";
export declare const MANAGED_MARKER = "Managed by cydetix setup";
export interface McpServerDefinition {
    readonly command: string;
    readonly args: readonly string[];
    readonly type?: "stdio";
}
export declare function commandAvailable(command: string, platform?: NodeJS.Platform, executablePath?: string): boolean;
export declare function existingPaths(paths: readonly string[]): string[];
export declare function pinnedMcpServer(context: SetupContext, includeType?: boolean): McpServerDefinition;
export declare function readRegularFile(filePath: string): Promise<string | undefined>;
export declare function atomicValidatedWrite(filePath: string, content: string, validate: (writtenPath: string, transientBackup: string | undefined) => void | Promise<void>): Promise<void>;
export declare function inspectJsonServer(filePath: string, rootKey: "mcpServers" | "servers", expected: McpServerDefinition): Promise<IntegrationState>;
export declare function updateJsonServer(filePath: string, rootKey: "mcpServers" | "servers", server: McpServerDefinition, remove: boolean, dryRun: boolean): Promise<boolean>;
export declare function inspectCodexToml(filePath: string, server: McpServerDefinition): Promise<IntegrationState>;
export declare function updateCodexToml(filePath: string, server: McpServerDefinition, remove: boolean, dryRun: boolean): Promise<boolean>;
export declare function inspectManagedFile(filePath: string): Promise<IntegrationState>;
export declare function writeManagedFile(filePath: string, content: string, remove: boolean, dryRun: boolean): Promise<boolean>;
export declare function installSkill(destination: string, includeOpenAiMetadata: boolean, remove: boolean, dryRun: boolean): Promise<string[]>;
export declare function combineIntegrationStates(states: readonly IntegrationState[]): IntegrationState;
export declare function agentInstructions(version: string): string;
//# sourceMappingURL=common.d.ts.map