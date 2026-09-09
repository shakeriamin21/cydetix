import path from "node:path";
import { agentInstructions, combineIntegrationStates, commandAvailable, existingPaths, inspectJsonServer, inspectManagedFile, pinnedMcpServer, updateJsonServer, writeManagedFile, } from "../common.js";
import { agentDetection } from "../discovery/index.js";
function targets(context) {
    return {
        config: path.join(context.projectRoot, ".cursor", "mcp.json"),
        rule: path.join(context.projectRoot, ".cursor", "rules", "cydetix.mdc"),
    };
}
function rule(context) {
    return `---
description: Use Cydetix for software security reviews, vulnerabilities, authentication, authorization, secrets, dependencies, supply chain, CI/CD, deployment readiness, hardening, and explicit security remediation.
alwaysApply: false
---

${agentInstructions(context)}`;
}
async function integrationState(context) {
    const target = targets(context);
    return combineIntegrationStates([
        await inspectJsonServer(context.projectBoundary, target.config, "mcpServers", pinnedMcpServer(context)),
        await inspectManagedFile(context.projectBoundary, target.rule),
    ]);
}
async function change(context, remove, dryRun) {
    const before = await integrationState(context);
    const target = targets(context);
    const changed = [];
    if (await updateJsonServer(context.projectBoundary, target.config, "mcpServers", pinnedMcpServer(context), remove, dryRun))
        changed.push(target.config);
    if (await writeManagedFile(context.projectBoundary, target.rule, rule(context), remove, dryRun))
        changed.push(target.rule);
    const after = dryRun
        ? remove
            ? "not_configured"
            : "configured"
        : await integrationState(context);
    return {
        id: "cursor",
        displayName: "Cursor",
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
export const cursorAdapter = {
    id: "cursor",
    displayName: "Cursor",
    compatibilityTier: "tier-1-native-mcp",
    capabilities: {
        mcpStdio: true,
        mcpHttp: false,
        projectScopedConfig: true,
        userScopedConfig: false,
        skills: false,
        instructionFiles: true,
    },
    configTargets(context) {
        const target = targets(context);
        return [target.config, target.rule];
    },
    async detect(context) {
        const evidence = existingPaths([
            path.join(context.homeDirectory, ".cursor"),
            path.join(context.projectRoot, ".cursor"),
        ]);
        if (commandAvailable("cursor", context.platform, context.executablePath) ||
            commandAvailable("cursor-agent", context.platform, context.executablePath))
            evidence.push("Cursor executable on PATH");
        return agentDetection(this.id, this.displayName, evidence, await integrationState(context));
    },
    install: (context, dryRun) => change(context, false, dryRun),
    verify: async (context) => (await integrationState(context)) === "configured",
    remove: (context, dryRun) => change(context, true, dryRun),
};
//# sourceMappingURL=index.js.map