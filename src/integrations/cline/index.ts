import path from "node:path";

import {
  commandAvailable,
  existingPaths,
  inspectJsonServer,
  pinnedMcpServer,
  updateJsonServer,
} from "../common.js";
import { agentDetection } from "../discovery/index.js";
import type { AdapterResult, IntegrationAdapter, SetupContext } from "../types.js";

function configPath(context: SetupContext): string {
  return path.join(context.homeDirectory, ".cline", "data", "settings", "cline_mcp_settings.json");
}

async function integrationState(context: SetupContext) {
  return inspectJsonServer(
    context.homeBoundary,
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
  const before = await integrationState(context);
  const config = configPath(context);
  const changed = await updateJsonServer(
    context.homeBoundary,
    config,
    "mcpServers",
    pinnedMcpServer(context),
    remove,
    dryRun,
  );
  const after = dryRun
    ? remove
      ? "not_configured"
      : "configured"
    : await integrationState(context);
  return {
    id: "cline",
    displayName: "Cline",
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

export const clineAdapter: IntegrationAdapter = {
  id: "cline",
  displayName: "Cline",
  compatibilityTier: "tier-1-native-mcp",
  capabilities: {
    mcpStdio: true,
    mcpHttp: false,
    projectScopedConfig: false,
    userScopedConfig: true,
    skills: false,
    instructionFiles: true,
  },
  configTargets: (context) => [configPath(context)],
  async detect(context) {
    const evidence = existingPaths([
      path.join(context.homeDirectory, ".cline"),
      path.join(context.projectRoot, ".clinerules"),
    ]);
    if (commandAvailable("cline", context.platform, context.executablePath))
      evidence.push("Cline executable on PATH");
    return agentDetection(this.id, this.displayName, evidence, await integrationState(context));
  },
  install: (context, dryRun) => change(context, false, dryRun),
  verify: async (context) => (await integrationState(context)) === "configured",
  remove: (context, dryRun) => change(context, true, dryRun),
};
