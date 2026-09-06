import type { AgentDetection, IntegrationAdapter, IntegrationState, SetupContext } from "../types.js";
export declare function agentDetection(id: AgentDetection["id"], displayName: string, evidence: readonly string[], integration: IntegrationState): AgentDetection;
export declare function discoverAgents(adapters: readonly IntegrationAdapter[], context: SetupContext): Promise<AgentDetection[]>;
export declare function needsConfiguration(detection: AgentDetection): boolean;
//# sourceMappingURL=index.d.ts.map