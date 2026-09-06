import path from "node:path";

import { atomicValidatedWrite, readRegularFile } from "./common.js";
import type { AgentId, IntegrationState } from "./types.js";

export type LocalIntegrationStatus = "configured" | "declined" | "partial";

export interface LocalIntegrationState {
  readonly schemaVersion: "1.0.0";
  readonly status: LocalIntegrationStatus;
  readonly packageVersion: string;
  readonly updatedAt: string;
  readonly hosts: Partial<Record<AgentId, IntegrationState>>;
}

export function integrationStatePath(projectRoot: string): string {
  return path.join(path.resolve(projectRoot), ".cydetix", "integration-state.json");
}

function parseState(value: unknown): LocalIntegrationState | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.schemaVersion !== "1.0.0" ||
    !["configured", "declined", "partial"].includes(String(candidate.status)) ||
    typeof candidate.packageVersion !== "string" ||
    typeof candidate.updatedAt !== "string" ||
    typeof candidate.hosts !== "object" ||
    candidate.hosts === null ||
    Array.isArray(candidate.hosts)
  )
    return undefined;
  return candidate as unknown as LocalIntegrationState;
}

export async function readIntegrationState(
  projectRoot: string,
): Promise<LocalIntegrationState | undefined> {
  try {
    const content = await readRegularFile(integrationStatePath(projectRoot));
    if (content === undefined) return undefined;
    return parseState(JSON.parse(content) as unknown);
  } catch {
    return undefined;
  }
}

export async function writeIntegrationState(
  projectRoot: string,
  state: LocalIntegrationState,
): Promise<void> {
  const target = integrationStatePath(projectRoot);
  const content = `${JSON.stringify(state, null, 2)}\n`;
  await atomicValidatedWrite(target, content, async (writtenPath) => {
    const written = await readRegularFile(writtenPath);
    if (written === undefined || parseState(JSON.parse(written) as unknown) === undefined)
      throw new Error("Cydetix integration state validation failed.");
  });
}
