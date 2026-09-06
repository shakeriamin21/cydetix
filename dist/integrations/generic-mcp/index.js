import path from "node:path";
import { inspectJsonServer, pinnedMcpServer, updateJsonServer } from "../common.js";
import { agentDetection } from "../discovery/index.js";
function configPath(context) {
    return path.join(context.projectRoot, ".cydetix", "mcp.json");
}
async function state(context) {
    return inspectJsonServer(configPath(context), "mcpServers", pinnedMcpServer(context));
}
async function change(context, remove, dryRun) {
    const before = await state(context);
    const config = configPath(context);
    const changed = await updateJsonServer(config, "mcpServers", pinnedMcpServer(context), remove, dryRun);
    const after = dryRun ? (remove ? "not_configured" : "configured") : await state(context);
    return {
        id: "generic-mcp",
        displayName: "Generic MCP",
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
export const genericMcpAdapter = {
    id: "generic-mcp",
    displayName: "Generic MCP",
    async detect(context) {
        return agentDetection(this.id, this.displayName, [], await state(context));
    },
    install: (context, dryRun) => change(context, false, dryRun),
    uninstall: (context, dryRun) => change(context, true, dryRun),
};
//# sourceMappingURL=index.js.map