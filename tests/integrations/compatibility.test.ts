import { mkdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  agentCompatibilityReportSchema,
  createAgentCompatibilityReport,
  renderAgentCompatibilityReport,
} from "../../src/integrations/compatibility.js";
import { runSetup } from "../../src/integrations/setup.js";
import { temporaryDirectory } from "../helpers/temporary.js";

async function fixture() {
  const root = await temporaryDirectory("cydetix-agent-doctor-");
  const project = path.join(root, "Project With Spaces");
  const home = path.join(root, "Home With Spaces");
  await Promise.all([mkdir(project, { recursive: true }), mkdir(home, { recursive: true })]);
  await Promise.all([
    mkdir(path.join(home, ".gemini"), { recursive: true }),
    mkdir(path.join(project, ".roo"), { recursive: true }),
  ]);
  return { project, home };
}

describe("agent compatibility diagnostics", () => {
  it("returns stable schema-backed capabilities, tiers, evidence, targets, and canonical runtime", async () => {
    const { project, home } = await fixture();
    const report = await createAgentCompatibilityReport({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
    });
    expect(() => agentCompatibilityReportSchema.parse(report)).not.toThrow();
    expect(report.schemaVersion).toBe("1.0.0");
    expect(report.cydetixVersion).toBe("0.6.0-alpha.11");
    expect(report.runtimeVersion).toBe("0.6.0-alpha.11");
    expect(report.projectRoot).toBe(project);
    expect(report.projectRootCanonical).toBe(true);
    expect(report.compatibilityTiers.map((tier) => tier.level)).toEqual([1, 2, 3]);
    expect(report.agents.map((agent) => agent.id)).toEqual([
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
    ]);
    expect(report.agents.every((agent) => agent.capabilities.mcpStdio)).toBe(true);
    expect(report.agents.every((agent) => !agent.capabilities.mcpHttp)).toBe(true);
    expect(report.agents.find((agent) => agent.id === "gemini")?.detected).toBe(true);
    expect(report.agents.find((agent) => agent.id === "roo")?.detected).toBe(true);
    expect(JSON.stringify(report)).not.toMatch(/token|api[_-]?key|secret-value/iu);

    const human = renderAgentCompatibilityReport(report);
    expect(human).toContain("Cydetix Agent Integrations");
    expect(human).toContain("Gemini CLI");
    expect(human).toContain("Tier 1");
    expect(human).toContain("canonical: yes");
  });

  it("reports a configured and verified Generic MCP escape hatch", async () => {
    const { project, home } = await fixture();
    await runSetup({
      projectRoot: project,
      homeDirectory: home,
      agents: ["generic-mcp"],
      yes: true,
      quiet: true,
    });
    const report = await createAgentCompatibilityReport({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
    });
    expect(report.agents.find((agent) => agent.id === "generic-mcp")).toMatchObject({
      compatibilityTier: "tier-1-native-mcp",
      configured: true,
      verified: true,
      integrationState: "configured",
    });
  });
});
