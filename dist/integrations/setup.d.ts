import type { AdapterResult, AgentDetection, AgentId, IntegrationAdapter, SetupContext } from "./types.js";
export declare const INTEGRATION_ADAPTERS: readonly IntegrationAdapter[];
export interface SetupOptions {
    readonly projectRoot?: string;
    readonly homeDirectory?: string;
    readonly agents?: readonly AgentId[];
    readonly all?: boolean;
    readonly yes?: boolean;
    readonly dryRun?: boolean;
    readonly uninstall?: boolean;
    readonly platform?: NodeJS.Platform;
}
export interface SetupReport {
    readonly detections: readonly AgentDetection[];
    readonly selected: readonly AgentId[];
    readonly results: readonly AdapterResult[];
    readonly cancelled: boolean;
    readonly dryRun: boolean;
}
export declare function integrationContext(options?: SetupOptions): SetupContext;
export declare function parseAgentId(value: string): AgentId;
export declare function runSetup(options?: SetupOptions): Promise<SetupReport>;
//# sourceMappingURL=setup.d.ts.map