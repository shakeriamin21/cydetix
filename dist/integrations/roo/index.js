import path from "node:path";
import { commandAvailable, existingPaths, inspectJsonServer, pinnedMcpServer, updateJsonServer, } from "../common.js";
import { agentDetection } from "../discovery/index.js";
function configPath(context) {
    return path.join(context.projectRoot, ".roo", "mcp.json");
}
async function integrationState(context) {
    return inspectJsonServer(context.projectBoundary, configPath(context), "mcpServers", pinnedMcpServer(context));
}
async function change(context, remove, dryRun) {
    const before = await integrationState(context);
    const config = configPath(context);
    const changed = await updateJsonServer(context.projectBoundary, config, "mcpServers", pinnedMcpServer(context), remove, dryRun);
    const after = dryRun
        ? remove
            ? "not_configured"
            : "configured"
        : await integrationState(context);
    return {
        id: "roo",
        displayName: "Roo Code",
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
export const rooAdapter = {
    id: "roo",
    displayName: "Roo Code",
    compatibilityTier: "tier-1-native-mcp",
    capabilities: {
        mcpStdio: true,
        mcpHttp: false,
        projectScopedConfig: true,
        userScopedConfig: true,
        skills: false,
        instructionFiles: true,
    },
    configTargets: (context) => [configPath(context)],
    async detect(context) {
        const evidence = existingPaths([
            path.join(context.homeDirectory, ".roo"),
            path.join(context.projectRoot, ".roo"),
        ]);
        if (commandAvailable("roo", context.platform, context.executablePath) ||
            commandAvailable("roo-code", context.platform, context.executablePath))
            evidence.push("Roo Code executable on PATH");
        return agentDetection(this.id, this.displayName, evidence, await integrationState(context));
    },
    install: (context, dryRun) => change(context, false, dryRun),
    verify: async (context) => (await integrationState(context)) === "configured",
    remove: (context, dryRun) => change(context, true, dryRun),
};
//# sourceMappingURL=index.js.map