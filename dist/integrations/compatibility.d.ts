import { z } from "zod";
import { type SetupOptions } from "./setup.js";
export declare const agentCapabilitiesSchema: z.ZodObject<{
    mcpStdio: z.ZodBoolean;
    mcpHttp: z.ZodBoolean;
    projectScopedConfig: z.ZodBoolean;
    userScopedConfig: z.ZodBoolean;
    skills: z.ZodBoolean;
    instructionFiles: z.ZodBoolean;
}, z.core.$strict>;
export declare const agentCompatibilityReportSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"1.0.0">;
    cydetixVersion: z.ZodString;
    projectRoot: z.ZodString;
    projectRootCanonical: z.ZodBoolean;
    runtimeVersion: z.ZodString;
    compatibilityTiers: z.ZodArray<z.ZodObject<{
        id: z.ZodEnum<{
            "tier-1-native-mcp": "tier-1-native-mcp";
            "tier-2-deterministic-cli": "tier-2-deterministic-cli";
            "tier-3-ci-report": "tier-3-ci-report";
        }>;
        level: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
        displayName: z.ZodString;
        description: z.ZodString;
    }, z.core.$strict>>;
    agents: z.ZodArray<z.ZodObject<{
        id: z.ZodEnum<{
            continue: "continue";
            codex: "codex";
            claude: "claude";
            cursor: "cursor";
            copilot: "copilot";
            windsurf: "windsurf";
            gemini: "gemini";
            cline: "cline";
            roo: "roo";
            goose: "goose";
            "generic-mcp": "generic-mcp";
        }>;
        displayName: z.ZodString;
        detected: z.ZodBoolean;
        installationState: z.ZodEnum<{
            installed: "installed";
            not_installed: "not_installed";
        }>;
        integrationState: z.ZodEnum<{
            configured: "configured";
            not_configured: "not_configured";
            partially_configured: "partially_configured";
            unsupported_version: "unsupported_version";
            configuration_inaccessible: "configuration_inaccessible";
        }>;
        compatibilityTier: z.ZodEnum<{
            "tier-1-native-mcp": "tier-1-native-mcp";
            "tier-2-deterministic-cli": "tier-2-deterministic-cli";
            "tier-3-ci-report": "tier-3-ci-report";
        }>;
        capabilities: z.ZodObject<{
            mcpStdio: z.ZodBoolean;
            mcpHttp: z.ZodBoolean;
            projectScopedConfig: z.ZodBoolean;
            userScopedConfig: z.ZodBoolean;
            skills: z.ZodBoolean;
            instructionFiles: z.ZodBoolean;
        }, z.core.$strict>;
        configured: z.ZodBoolean;
        verified: z.ZodNullable<z.ZodBoolean>;
        evidence: z.ZodArray<z.ZodString>;
        configTargets: z.ZodArray<z.ZodString>;
        runtimeVersion: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type AgentCompatibilityReport = z.infer<typeof agentCompatibilityReportSchema>;
export declare function createAgentCompatibilityReport(options?: Pick<SetupOptions, "projectRoot" | "homeDirectory" | "platform" | "executablePath">): Promise<AgentCompatibilityReport>;
export declare function renderAgentCompatibilityReport(report: AgentCompatibilityReport): string;
//# sourceMappingURL=compatibility.d.ts.map