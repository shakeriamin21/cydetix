import path from "node:path";

import { inspectJsonServer, pinnedMcpServer, updateJsonServer } from "../common.js";
import { agentDetection } from "../discovery/index.js";
import type { AdapterResult, IntegrationAdapter, SetupContext } from "../types.js";

function configPath(context: SetupContext): string {
  return path.join(context.projectRoot, ".cydetix", "mcp.json");
}

async function state(context: SetupContext) {
  return inspectJsonServer(
    context.projectBoundary,
    configPath(context),
    "mcpServers",
    pinnedMcpServer(context),
  );
}

async function change(
  context: SetupContext,
  remove: boolean,
  dryRun: boolean,
): Promise<AdapterResult> {
  const before = await state(context);
  const config = configPath(context);
  const changed = await updateJsonServer(
    context.projectBoundary,
    config,
    "mcpServers",
    pinnedMcpServer(context),
    remove,
    dryRun,
  );
  const after = dryRun ? (remove ? "not_configured" : "configured") : await state(context);
  return {
    id: "generic-mcp",
    displayName: "Generic MCP",
    files: changed ? [config] : [],
    action: changed
      ? remove
        ? "removed"
        : before === "not_configured"
          ? "installed"
          : "updated"
      : "unchanged",
    verified: remove ? after === "not_configured" : after === "configured",
  };
}

export const genericMcpAdapter: IntegrationAdapter = {
  id: "generic-mcp",
  displayName: "Generic MCP",
  async detect(context) {
    return agentDetection(this.id, this.displayName, [], await state(context));
  },
  install: (context, dryRun) => change(context, false, dryRun),
  uninstall: (context, dryRun) => change(context, true, dryRun),
};
