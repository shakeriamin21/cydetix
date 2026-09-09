import path from "node:path";
import { combineIntegrationStates, commandAvailable, existingPaths, inspectJsonServer, inspectManagedFile, installSkill, pinnedMcpServer, updateJsonServer, } from "../common.js";
import { agentDetection } from "../discovery/index.js";
function targets(context) {
    const skill = path.join(context.projectRoot, ".github", "skills", "cydetix");
    return {
        config: path.join(context.projectRoot, ".vscode", "mcp.json"),
        skill,
        skillFile: path.join(skill, "SKILL.md"),
    };
}
async function integrationState(context) {
    const target = targets(context);
    return combineIntegrationStates([
        await inspectJsonServer(context.projectBoundary, target.config, "servers", pinnedMcpServer(context, true)),
        await inspectManagedFile(context.projectBoundary, target.skillFile),
    ]);
}
async function change(context, remove, dryRun) {
    const before = await integrationState(context);
    const target = targets(context);
    const changed = await installSkill(context.projectBoundary, target.skill, false, remove, dryRun, context);
    if (await updateJsonServer(context.projectBoundary, target.config, "servers", pinnedMcpServer(context, true), remove, dryRun))
        changed.push(target.config);
    const after = dryRun
        ? remove
            ? "not_configured"
            : "configured"
        : await integrationState(context);
    return {
        id: "copilot",
        displayName: "GitHub Copilot",
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
export const copilotAdapter = {
    id: "copilot",
    displayName: "GitHub Copilot",
    async detect(context) {
        const evidence = existingPaths([
            path.join(context.homeDirectory, ".copilot"),
            path.join(context.projectRoot, ".github", "copilot-instructions.md"),
            path.join(context.projectRoot, ".github", "skills"),
            path.join(context.projectRoot, ".vscode", "mcp.json"),
        ]);
        if (commandAvailable("copilot", context.platform, context.executablePath))
            evidence.push("copilot executable on PATH");
        return agentDetection(this.id, this.displayName, evidence, await integrationState(context));
    },
    install: (context, dryRun) => change(context, false, dryRun),
    uninstall: (context, dryRun) => change(context, true, dryRun),
};
//# sourceMappingURL=index.js.map