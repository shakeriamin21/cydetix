import { z } from "zod";
import { PRODUCT } from "../core/brand.js";
import { terminalSafe } from "../reporting/terminal.js";
import { discoverAgents } from "./discovery/index.js";
import { INTEGRATION_ADAPTERS, integrationContext } from "./setup.js";
import { COMPATIBILITY_TIERS } from "./types.js";
export const agentCapabilitiesSchema = z
    .object({
    mcpStdio: z.boolean(),
    mcpHttp: z.boolean(),
    projectScopedConfig: z.boolean(),
    userScopedConfig: z.boolean(),
    skills: z.boolean(),
    instructionFiles: z.boolean(),
})
    .strict();
export const agentCompatibilityReportSchema = z
    .object({
    schemaVersion: z.literal("1.0.0"),
    cydetixVersion: z.string(),
    projectRoot: z.string(),
    projectRootCanonical: z.boolean(),
    runtimeVersion: z.string(),
    compatibilityTiers: z.array(z
        .object({
        id: z.enum(["tier-1-native-mcp", "tier-2-deterministic-cli", "tier-3-ci-report"]),
        level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        displayName: z.string(),
        description: z.string(),
    })
        .strict()),
    agents: z.array(z
        .object({
        id: z.enum([
            "codex",
            "claude",
            "cursor",
            "copilot",
            "windsurf",
            "gemini",
            "cline",
            "roo",
            "continue",
            "goose",
            "generic-mcp",
        ]),
        displayName: z.string(),
        detected: z.boolean(),
        installationState: z.enum(["installed", "not_installed"]),
        integrationState: z.enum([
            "configured",
            "not_configured",
            "partially_configured",
            "unsupported_version",
            "configuration_inaccessible",
        ]),
        compatibilityTier: z.enum([
            "tier-1-native-mcp",
            "tier-2-deterministic-cli",
            "tier-3-ci-report",
        ]),
        capabilities: agentCapabilitiesSchema,
        configured: z.boolean(),
        verified: z.boolean().nullable(),
        evidence: z.array(z.string()),
        configTargets: z.array(z.string()),
        runtimeVersion: z.string(),
    })
        .strict()),
})
    .strict();
export async function createAgentCompatibilityReport(options = {}) {
    const context = await integrationContext(options);
    const detections = await discoverAgents(INTEGRATION_ADAPTERS, context);
    const agents = await Promise.all(INTEGRATION_ADAPTERS.map(async (adapter) => {
        const detection = detections.find((candidate) => candidate.id === adapter.id);
        if (detection === undefined)
            throw new Error(`Missing agent detection: ${adapter.id}`);
        const configured = detection.integration === "configured";
        return {
            id: adapter.id,
            displayName: adapter.displayName,
            detected: detection.detected,
            installationState: detection.installation,
            integrationState: detection.integration,
            compatibilityTier: adapter.compatibilityTier,
            capabilities: adapter.capabilities,
            configured,
            verified: configured ? await adapter.verify(context) : null,
            evidence: [...detection.evidence],
            configTargets: [...adapter.configTargets(context)],
            runtimeVersion: context.runtime.version,
        };
    }));
    return agentCompatibilityReportSchema.parse({
        schemaVersion: "1.0.0",
        cydetixVersion: PRODUCT.version,
        projectRoot: context.projectRoot,
        projectRootCanonical: context.projectBoundary.root === context.projectRoot,
        runtimeVersion: context.runtime.version,
        compatibilityTiers: COMPATIBILITY_TIERS,
        agents,
    });
}
export function renderAgentCompatibilityReport(report) {
    const rows = report.agents.map((agent) => [
        agent.displayName,
        agent.detected ? "Yes" : "No",
        `Tier ${agent.compatibilityTier.slice(5, 6)}`,
        agent.capabilities.mcpStdio ? "stdio" : "-",
        agent.capabilities.skills ? "Yes" : "No",
        agent.configured ? "Yes" : "No",
        agent.verified === null ? "-" : agent.verified ? "PASS" : "FAIL",
    ]);
    const headers = ["Agent", "Detected", "Tier", "MCP", "Skill", "Configured", "Verified"];
    const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0)));
    const line = (row) => row
        .map((value, index) => value.padEnd(widths[index] ?? value.length))
        .join("  ")
        .trimEnd();
    return [
        "Cydetix Agent Integrations",
        "",
        line(headers),
        widths.map((width) => "-".repeat(width)).join("  "),
        ...rows.map(line),
        "",
        `Runtime: ${terminalSafe(report.runtimeVersion)}`,
        `Project root: ${terminalSafe(report.projectRoot)} (canonical: ${report.projectRootCanonical ? "yes" : "no"})`,
        "",
    ].join("\n");
}
//# sourceMappingURL=compatibility.js.map