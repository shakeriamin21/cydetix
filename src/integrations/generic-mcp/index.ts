import path from "node:path";

import { pinnedMcpServer, updateJsonServer } from "../common.js";
import type { AdapterResult, IntegrationAdapter, SetupContext } from "../types.js";

async function change(
  context: SetupContext,
  remove: boolean,
  dryRun: boolean,
): Promise<AdapterResult> {
  const config = path.join(context.projectRoot, ".vibeshield", "mcp.json");
  const changed = await updateJsonServer(
    config,
    "mcpServers",
    pinnedMcpServer(context),
    remove,
    dryRun,
  );
  return {
    id: "generic-mcp",
    displayName: "Generic MCP",
    files: changed ? [config] : [],
    action: changed ? (remove ? "removed" : "installed") : "unchanged",
  };
}

export const genericMcpAdapter: IntegrationAdapter = {
  id: "generic-mcp",
  displayName: "Generic MCP",
  detect() {
    return { id: this.id, displayName: this.displayName, detected: false, evidence: [] };
  },
  install: (context, dryRun) => change(context, false, dryRun),
  uninstall: (context, dryRun) => change(context, true, dryRun),
};
