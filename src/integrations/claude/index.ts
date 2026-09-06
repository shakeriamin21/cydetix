import path from "node:path";

import {
  commandAvailable,
  existingPaths,
  installSkill,
  pinnedMcpServer,
  updateJsonServer,
} from "../common.js";
import type { AdapterResult, IntegrationAdapter, SetupContext } from "../types.js";

async function change(
  context: SetupContext,
  remove: boolean,
  dryRun: boolean,
): Promise<AdapterResult> {
  const config = path.join(context.projectRoot, ".mcp.json");
  const skill = path.join(context.projectRoot, ".claude", "skills", "vibeshield");
  const changed = await installSkill(skill, false, remove, dryRun);
  if (await updateJsonServer(config, "mcpServers", pinnedMcpServer(context), remove, dryRun))
    changed.push(config);
  return {
    id: "claude",
    displayName: "Claude Code",
    files: changed,
    action: changed.length === 0 ? "unchanged" : remove ? "removed" : "installed",
  };
}

export const claudeAdapter: IntegrationAdapter = {
  id: "claude",
  displayName: "Claude Code",
  detect(context) {
    const evidence = existingPaths([
      path.join(context.homeDirectory, ".claude"),
      path.join(context.projectRoot, ".claude"),
      path.join(context.projectRoot, "CLAUDE.md"),
    ]);
    if (commandAvailable("claude")) evidence.push("claude executable on PATH");
    return { id: this.id, displayName: this.displayName, detected: evidence.length > 0, evidence };
  },
  install: (context, dryRun) => change(context, false, dryRun),
  uninstall: (context, dryRun) => change(context, true, dryRun),
};
