import path from "node:path";
import { combineIntegrationStates, commandAvailable, existingPaths, inspectJsonServer, inspectManagedFile, installSkill, pinnedMcpServer, updateJsonServer, } from "../common.js";
import { agentDetection } from "../discovery/index.js";
function targets(context) {
    const skill = path.join(context.projectRoot, ".claude", "skills", "cydetix");
    return {
        config: path.join(context.projectRoot, ".mcp.json"),
        skill,
        skillFile: path.join(skill, "SKILL.md"),
    };
}
async function integrationState(context) {
    const target = targets(context);
    return combineIntegrationStates([
        await inspectJsonServer(context.projectBoundary, target.config, "mcpServers", pinnedMcpServer(context)),
        await inspectManagedFile(context.projectBoundary, target.skillFile),
    ]);
}
async function change(context, remove, dryRun) {
    const before = await integrationState(context);
    const target = targets(context);
    const changed = await installSkill(context.projectBoundary, target.skill, false, remove, dryRun, context);
    if (await updateJsonServer(context.projectBoundary, target.config, "mcpServers", pinnedMcpServer(context), remove, dryRun))
        changed.push(target.config);
    const after = dryRun
        ? remove
            ? "not_configured"
            : "configured"
        : await integrationState(context);
    return {
        id: "claude",
        displayName: "Claude Code",
        files: changed,
        action: changed.length === 0
            ? "unchanged"
            : remove
                ? "removed"
                : before === "not_configured"
                    ? "installed"
                    : "updated",
        verified: remove ? after === "not_configured" : after === "configured",
    };
}
export const claudeAdapter = {
    id: "claude",
    displayName: "Claude Code",
    async detect(context) {
        const evidence = existingPaths([
            path.join(context.homeDirectory, ".claude"),
            path.join(context.homeDirectory, ".claude.json"),
            path.join(context.projectRoot, ".claude"),
            path.join(context.projectRoot, "CLAUDE.md"),
        ]);
        if (commandAvailable("claude", context.platform, context.executablePath))
            evidence.push("claude executable on PATH");
        return agentDetection(this.id, this.displayName, evidence, await integrationState(context));
    },
    install: (context, dryRun) => change(context, false, dryRun),
    uninstall: (context, dryRun) => change(context, true, dryRun),
};
//# sourceMappingURL=index.js.map