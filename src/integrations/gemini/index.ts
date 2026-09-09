import path from "node:path";

import {
  combineIntegrationStates,
  commandAvailable,
  existingPaths,
  inspectJsonServer,
  inspectManagedFile,
  installSkill,
  pinnedMcpServer,
  updateJsonServer,
} from "../common.js";
import { agentDetection } from "../discovery/index.js";
import type { AdapterResult, IntegrationAdapter, SetupContext } from "../types.js";

function targets(context: SetupContext) {
  const skill = path.join(context.projectRoot, ".gemini", "skills", "cydetix");
  return {
    config: path.join(context.projectRoot, ".gemini", "settings.json"),
    skill,
    skillFile: path.join(skill, "SKILL.md"),
  };
}

async function integrationState(context: SetupContext) {
  const target = targets(context);
  return combineIntegrationStates([
    await inspectJsonServer(
      context.projectBoundary,
      target.config,
      "mcpServers",
      pinnedMcpServer(context),
    ),
    await inspectManagedFile(context.projectBoundary, target.skillFile),
  ]);
}

async function change(
  context: SetupContext,
  remove: boolean,
  dryRun: boolean,
): Promise<AdapterResult> {
  const before = await integrationState(context);
  const target = targets(context);
  const changed = await installSkill(
    context.projectBoundary,
    target.skill,
    false,
    remove,
    dryRun,
    context,
  );
  if (
    await updateJsonServer(
      context.projectBoundary,
      target.config,
      "mcpServers",
      pinnedMcpServer(context),
      remove,
      dryRun,
    )
  )
    changed.push(target.config);
  const after = dryRun
    ? remove
      ? "not_configured"
      : "configured"
    : await integrationState(context);
  return {
    id: "gemini",
    displayName: "Gemini CLI",
    files: changed,
    action:
      changed.length === 0
        ? "unchanged"
        : remove
          ? "removed"
          : before === "not_configured"
            ? "installed"
            : "updated",
    verified: remove ? after === "not_configured" : after === "configured",
  };
}

export const geminiAdapter: IntegrationAdapter = {
  id: "gemini",
  displayName: "Gemini CLI",
  compatibilityTier: "tier-1-native-mcp",
  capabilities: {
    mcpStdio: true,
    mcpHttp: false,
    projectScopedConfig: true,
    userScopedConfig: true,
    skills: true,
    instructionFiles: true,
  },
  configTargets(context) {
    const target = targets(context);
    return [target.config, target.skillFile];
  },
  async detect(context) {
    const evidence = existingPaths([
      path.join(context.homeDirectory, ".gemini"),
      path.join(context.projectRoot, ".gemini"),
      path.join(context.projectRoot, "GEMINI.md"),
    ]);
    if (commandAvailable("gemini", context.platform, context.executablePath))
      evidence.push("Gemini CLI executable on PATH");
    return agentDetection(this.id, this.displayName, evidence, await integrationState(context));
  },
  install: (context, dryRun) => change(context, false, dryRun),
  verify: async (context) => (await integrationState(context)) === "configured",
  remove: (context, dryRun) => change(context, true, dryRun),
};
