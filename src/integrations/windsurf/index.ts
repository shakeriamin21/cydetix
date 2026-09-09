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
  const skill = path.join(context.projectRoot, ".windsurf", "skills", "cydetix");
  const legacyRoot = path.join(context.homeDirectory, ".codeium", "windsurf");
  return {
    currentConfig: path.join(context.projectRoot, ".devin", "mcp_config.local.json"),
    legacyConfig: path.join(legacyRoot, "mcp_config.json"),
    legacyPresent: existingPaths([legacyRoot]).length > 0,
    skill,
    skillFile: path.join(skill, "SKILL.md"),
  };
}

async function integrationState(context: SetupContext) {
  const target = targets(context);
  const states = [
    await inspectJsonServer(
      context.projectBoundary,
      target.currentConfig,
      "mcpServers",
      pinnedMcpServer(context),
    ),
    await inspectManagedFile(context.projectBoundary, target.skillFile),
  ];
  if (target.legacyPresent)
    states.push(
      await inspectJsonServer(
        context.homeBoundary,
        target.legacyConfig,
        "mcpServers",
        pinnedMcpServer(context),
      ),
    );
  return combineIntegrationStates(states);
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
      target.currentConfig,
      "mcpServers",
      pinnedMcpServer(context),
      remove,
      dryRun,
    )
  )
    changed.push(target.currentConfig);
  if (
    target.legacyPresent &&
    (await updateJsonServer(
      context.homeBoundary,
      target.legacyConfig,
      "mcpServers",
      pinnedMcpServer(context),
      remove,
      dryRun,
    ))
  )
    changed.push(target.legacyConfig);
  const after = dryRun
    ? remove
      ? "not_configured"
      : "configured"
    : await integrationState(context);
  return {
    id: "windsurf",
    displayName: "Windsurf",
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

export const windsurfAdapter: IntegrationAdapter = {
  id: "windsurf",
  displayName: "Windsurf",
  async detect(context) {
    const evidence = existingPaths([
      path.join(context.homeDirectory, ".codeium", "windsurf"),
      path.join(context.homeDirectory, ".config", "devin"),
      path.join(context.projectRoot, ".windsurf"),
      path.join(context.projectRoot, ".devin"),
    ]);
    if (
      commandAvailable("windsurf", context.platform, context.executablePath) ||
      commandAvailable("devin", context.platform, context.executablePath)
    )
      evidence.push("Windsurf/Devin executable on PATH");
    return agentDetection(this.id, this.displayName, evidence, await integrationState(context));
  },
  install: (context, dryRun) => change(context, false, dryRun),
  uninstall: (context, dryRun) => change(context, true, dryRun),
};
