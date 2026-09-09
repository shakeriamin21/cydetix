import path from "node:path";

import {
  commandAvailable,
  existingPaths,
  inspectYamlEntry,
  pinnedMcpServer,
  updateYamlEntry,
} from "../common.js";
import { agentDetection } from "../discovery/index.js";
import type { AdapterResult, IntegrationAdapter, SetupContext } from "../types.js";

function configPath(context: SetupContext): string {
  return context.platform === "win32"
    ? path.join(
        context.homeDirectory,
        "AppData",
        "Roaming",
        "Block",
        "goose",
        "config",
        "config.yaml",
      )
    : path.join(context.homeDirectory, ".config", "goose", "config.yaml");
}

function extension(context: SetupContext): Readonly<Record<string, unknown>> {
  const server = pinnedMcpServer(context);
  return {
    name: "Cydetix",
    description: "Deterministic local security analysis and policy-bounded remediation.",
    type: "stdio",
    cmd: server.command,
    args: server.args,
    enabled: true,
    envs: { CYDETIX_AGENT_SUBPROCESS: "1" },
    timeout: 300,
  };
}

async function integrationState(context: SetupContext) {
  return inspectYamlEntry(
    context.homeBoundary,
    configPath(context),
    "extensions",
    "cydetix",
    extension(context),
  );
}

async function change(
  context: SetupContext,
  remove: boolean,
  dryRun: boolean,
): Promise<AdapterResult> {
  const before = await integrationState(context);
  const config = configPath(context);
  const changed = await updateYamlEntry(
    context.homeBoundary,
    config,
    "extensions",
    "cydetix",
    extension(context),
    remove,
    dryRun,
  );
  const after = dryRun
    ? remove
      ? "not_configured"
      : "configured"
    : await integrationState(context);
  return {
    id: "goose",
    displayName: "Goose",
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

export const gooseAdapter: IntegrationAdapter = {
  id: "goose",
  displayName: "Goose",
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
      path.join(context.homeDirectory, ".config", "goose"),
      path.join(context.homeDirectory, "AppData", "Roaming", "Block", "goose"),
      path.join(context.projectRoot, ".goosehints"),
    ]);
    if (commandAvailable("goose", context.platform, context.executablePath))
      evidence.push("Goose executable on PATH");
    return agentDetection(this.id, this.displayName, evidence, await integrationState(context));
  },
  install: (context, dryRun) => change(context, false, dryRun),
  verify: async (context) => (await integrationState(context)) === "configured",
  remove: (context, dryRun) => change(context, true, dryRun),
};
