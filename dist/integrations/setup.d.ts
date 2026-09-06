import type { AdapterResult, AgentDetection, AgentId, IntegrationAdapter, SetupContext } from "./types.js";
export declare const INTEGRATION_ADAPTERS: readonly IntegrationAdapter[];
export interface SetupOptions {
    readonly projectRoot?: string;
    readonly homeDirectory?: string;
    readonly agents?: readonly AgentId[];
    readonly all?: boolean;
    readonly yes?: boolean;
    readonly dryRun?: boolean;
    readonly remove?: boolean;
    readonly status?: boolean;
    readonly verify?: boolean;
    readonly quiet?: boolean;
    readonly interactive?: boolean;
    readonly confirm?: (prompt: string) => boolean | Promise<boolean>;
    readonly platform?: NodeJS.Platform;
    readonly executablePath?: string;
}
export interface SetupReport {
    readonly detections: readonly AgentDetection[];
    readonly selected: readonly AgentId[];
    readonly results: readonly AdapterResult[];
    readonly cancelled: boolean;
    readonly dryRun: boolean;
    readonly verified: boolean;
}
export declare function integrationContext(options?: SetupOptions): SetupContext;
export declare function parseAgentId(value: string): AgentId;
export declare function runSetup(options?: SetupOptions): Promise<SetupReport>;
export declare function runAutomaticIntegration(options?: SetupOptions): Promise<SetupReport>;
//# sourceMappingURL=setup.d.ts.map