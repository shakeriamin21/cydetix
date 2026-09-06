import type { AgentId, IntegrationState } from "./types.js";
export type LocalIntegrationStatus = "configured" | "declined" | "partial";
export interface LocalIntegrationState {
    readonly schemaVersion: "1.0.0";
    readonly status: LocalIntegrationStatus;
    readonly packageVersion: string;
    readonly updatedAt: string;
    readonly hosts: Partial<Record<AgentId, IntegrationState>>;
}
export declare function integrationStatePath(projectRoot: string): string;
export declare function readIntegrationState(projectRoot: string): Promise<LocalIntegrationState | undefined>;
export declare function writeIntegrationState(projectRoot: string, state: LocalIntegrationState): Promise<void>;
//# sourceMappingURL=state.d.ts.map