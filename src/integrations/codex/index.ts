import path from "node:path";

import {
  combineIntegrationStates,
  commandAvailable,
  existingPaths,
  inspectCodexToml,
  inspectManagedFile,
  installSkill,
  pinnedMcpServer,
  updateCodexToml,
} from "../common.js";
import { agentDetection } from "../discovery/index.js";
import type { AdapterResult, IntegrationAdapter, SetupContext } from "../types.js";

function paths(context: SetupContext): { config: string; skill: string; metadata: string } {
  const skill = path.join(context.homeDirectory, ".codex", "skills", "cydetix");
  return {
    config: path.join(context.homeDirectory, ".codex", "config.toml"),
    skill,
    metadata: path.join(skill, "agents", "openai.yaml"),
  };
}

async function integrationState(context: SetupContext) {
  const target = paths(context);
  return combineIntegrationStates([
    await inspectCodexToml(target.config, pinnedMcpServer(context)),
    await inspectManagedFile(path.join(target.skill, "SKILL.md")),
    await inspectManagedFile(target.metadata),
  ]);
}

async function change(
  context: SetupContext,
  remove: boolean,
  dryRun: boolean,
): Promise<AdapterResult> {
  const before = await integrationState(context);
  const target = paths(context);
  const changed = await installSkill(target.skill, true, remove, dryRun);
  if (await updateCodexToml(target.config, pinnedMcpServer(context), remove, dryRun))
    changed.push(target.config);
  const after = dryRun
    ? remove
      ? "not_configured"
      : "configured"
    : await integrationState(context);
  return {
    id: "codex",
    displayName: "OpenAI Codex",
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

export const codexAdapter: IntegrationAdapter = {
  id: "codex",
  displayName: "OpenAI Codex",
  async detect(context) {
    const evidence = existingPaths([
      path.join(context.homeDirectory, ".codex"),
      path.join(context.homeDirectory, ".chatgpt"),
      path.join(context.projectRoot, ".codex"),
    ]);
    if (commandAvailable("codex", context.platform, context.executablePath))
      evidence.push("codex executable on PATH");
    return agentDetection(this.id, this.displayName, evidence, await integrationState(context));
  },
  install: (context, dryRun) => change(context, false, dryRun),
  uninstall: (context, dryRun) => change(context, true, dryRun),
};
