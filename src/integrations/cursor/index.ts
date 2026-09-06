import path from "node:path";

import {
  AGENT_INSTRUCTIONS,
  commandAvailable,
  existingPaths,
  pinnedMcpServer,
  updateJsonServer,
  writeManagedFile,
} from "../common.js";
import type { AdapterResult, IntegrationAdapter, SetupContext } from "../types.js";

const RULE = `---
description: Use VibeShield for security audits, authentication, authorization, secrets, dependencies, supply chain, CI/CD, deployment readiness, and explicit security remediation.
globs:
alwaysApply: false
---

${AGENT_INSTRUCTIONS}`;

async function change(
  context: SetupContext,
  remove: boolean,
  dryRun: boolean,
): Promise<AdapterResult> {
  const config = path.join(context.projectRoot, ".cursor", "mcp.json");
  const rule = path.join(context.projectRoot, ".cursor", "rules", "vibeshield.mdc");
  const changed: string[] = [];
  if (await updateJsonServer(config, "mcpServers", pinnedMcpServer(context), remove, dryRun))
    changed.push(config);
  if (await writeManagedFile(rule, RULE, remove, dryRun)) changed.push(rule);
  return {
    id: "cursor",
    displayName: "Cursor",
    files: changed,
    action: changed.length === 0 ? "unchanged" : remove ? "removed" : "installed",
  };
}

export const cursorAdapter: IntegrationAdapter = {
  id: "cursor",
  displayName: "Cursor",
  detect(context) {
    const evidence = existingPaths([
      path.join(context.homeDirectory, ".cursor"),
      path.join(context.projectRoot, ".cursor"),
    ]);
    if (commandAvailable("cursor") || commandAvailable("cursor-agent"))
      evidence.push("Cursor executable on PATH");
    return { id: this.id, displayName: this.displayName, detected: evidence.length > 0, evidence };
  },
  install: (context, dryRun) => change(context, false, dryRun),
  uninstall: (context, dryRun) => change(context, true, dryRun),
};
