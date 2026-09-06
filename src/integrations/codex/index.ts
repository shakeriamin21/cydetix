import path from "node:path";

import {
  commandAvailable,
  existingPaths,
  installSkill,
  pinnedMcpServer,
  updateCodexToml,
} from "../common.js";
import type { AdapterResult, IntegrationAdapter, SetupContext } from "../types.js";

function paths(context: SetupContext): { config: string; skill: string } {
  return {
    config: path.join(context.homeDirectory, ".codex", "config.toml"),
    skill: path.join(context.homeDirectory, ".codex", "skills", "vibeshield"),
  };
}

async function change(
  context: SetupContext,
  remove: boolean,
  dryRun: boolean,
): Promise<AdapterResult> {
  const target = paths(context);
  const changed = await installSkill(target.skill, true, remove, dryRun);
  if (await updateCodexToml(target.config, pinnedMcpServer(context), remove, dryRun))
    changed.push(target.config);
  return {
    id: "codex",
    displayName: "Codex",
    files: changed,
    action: changed.length === 0 ? "unchanged" : remove ? "removed" : "installed",
  };
}

export const codexAdapter: IntegrationAdapter = {
  id: "codex",
  displayName: "Codex",
  detect(context) {
    const evidence = existingPaths([
      path.join(context.homeDirectory, ".codex"),
      path.join(context.homeDirectory, ".chatgpt"),
      path.join(context.projectRoot, ".codex"),
    ]);
    if (commandAvailable("codex")) evidence.push("codex executable on PATH");
    return { id: this.id, displayName: this.displayName, detected: evidence.length > 0, evidence };
  },
  install: (context, dryRun) => change(context, false, dryRun),
  uninstall: (context, dryRun) => change(context, true, dryRun),
};
