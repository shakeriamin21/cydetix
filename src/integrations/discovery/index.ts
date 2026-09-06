import type {
  AgentDetection,
  IntegrationAdapter,
  IntegrationState,
  SetupContext,
} from "../types.js";

export function agentDetection(
  id: AgentDetection["id"],
  displayName: string,
  evidence: readonly string[],
  integration: IntegrationState,
): AgentDetection {
  const detected = evidence.length > 0;
  return {
    id,
    displayName,
    detected,
    installation: detected ? "installed" : "not_installed",
    integration,
    evidence,
  };
}

export async function discoverAgents(
  adapters: readonly IntegrationAdapter[],
  context: SetupContext,
): Promise<AgentDetection[]> {
  return Promise.all(adapters.map((adapter) => Promise.resolve(adapter.detect(context))));
}

export function needsConfiguration(detection: AgentDetection): boolean {
  return detection.detected && detection.integration !== "configured";
}
