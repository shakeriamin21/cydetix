import path from "node:path";
import { AGENT_INSTRUCTIONS, commandAvailable, existingPaths, pinnedMcpServer, updateJsonServer, writeManagedFile, } from "../common.js";
const RULE = `---
trigger: model_decision
description: Use VibeShield for security reviews, vulnerability assessment, deployment readiness, and explicit security remediation.
---

${AGENT_INSTRUCTIONS}`;
async function change(context, remove, dryRun) {
    const config = path.join(context.homeDirectory, ".codeium", "windsurf", "mcp_config.json");
    const rule = path.join(context.projectRoot, ".windsurf", "rules", "vibeshield.md");
    const changed = [];
    if (await updateJsonServer(config, "mcpServers", pinnedMcpServer(context), remove, dryRun))
        changed.push(config);
    if (await writeManagedFile(rule, RULE, remove, dryRun))
        changed.push(rule);
    return {
        id: "windsurf",
        displayName: "Windsurf",
        files: changed,
        action: changed.length === 0 ? "unchanged" : remove ? "removed" : "installed",
    };
}
export const windsurfAdapter = {
    id: "windsurf",
    displayName: "Windsurf",
    detect(context) {
        const evidence = existingPaths([
            path.join(context.homeDirectory, ".codeium", "windsurf"),
            path.join(context.projectRoot, ".windsurf"),
        ]);
        if (commandAvailable("windsurf"))
            evidence.push("windsurf executable on PATH");
        return { id: this.id, displayName: this.displayName, detected: evidence.length > 0, evidence };
    },
    install: (context, dryRun) => change(context, false, dryRun),
    uninstall: (context, dryRun) => change(context, true, dryRun),
};
//# sourceMappingURL=index.js.map