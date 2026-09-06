import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { atomicValidatedWrite, pinnedMcpServer } from "../../src/integrations/common.js";
import {
  integrationContext,
  INTEGRATION_ADAPTERS,
  runAutomaticIntegration,
  runSetup,
} from "../../src/integrations/setup.js";
import { readIntegrationState } from "../../src/integrations/state.js";
import type { AgentId } from "../../src/integrations/types.js";
import { temporaryDirectory } from "../helpers/temporary.js";

async function environment(prefix = "cydetix-setup-") {
  const root = await temporaryDirectory(prefix);
  const project = path.join(root, "project");
  const home = path.join(root, "home");
  await mkdir(project, { recursive: true });
  await mkdir(home, { recursive: true });
  return { root, project, home };
}

async function markDetected(id: Exclude<AgentId, "generic-mcp">, _project: string, home: string) {
  const targets: Record<Exclude<AgentId, "generic-mcp">, string> = {
    codex: path.join(home, ".codex"),
    claude: path.join(home, ".claude"),
    cursor: path.join(home, ".cursor"),
    copilot: path.join(home, ".copilot"),
    windsurf: path.join(home, ".codeium", "windsurf"),
  };
  await mkdir(targets[id], { recursive: true });
}

async function detection(id: AgentId, project: string, home: string) {
  const adapter = INTEGRATION_ADAPTERS.find((candidate) => candidate.id === id);
  if (adapter === undefined) throw new Error(`Missing adapter: ${id}`);
  return adapter.detect(
    integrationContext({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
      platform: process.platform,
    }),
  );
}

describe("universal agent setup", () => {
  it("reports no AI hosts installed", async () => {
    const { project, home } = await environment();
    const report = await runSetup({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
      status: true,
      quiet: true,
    });
    expect(report.detections.filter((item) => item.detected)).toHaveLength(0);
  });

  it("generates shell-free pinned launchers for Windows, Linux, and macOS", () => {
    const base = {
      projectRoot: "project",
      homeDirectory: "home",
      packageVersion: "0.6.0-alpha.3",
      executablePath: "",
    };
    expect(pinnedMcpServer({ ...base, platform: "win32" })).toEqual({
      command: "cmd",
      args: ["/c", "npx", "--yes", "cydetix@0.6.0-alpha.3", "mcp"],
    });
    for (const platform of ["linux", "darwin"] as const)
      expect(pinnedMcpServer({ ...base, platform })).toEqual({
        command: "npx",
        args: ["--yes", "cydetix@0.6.0-alpha.3", "mcp"],
      });
  });

  for (const id of ["codex", "claude", "cursor", "copilot", "windsurf"] as const) {
    it(`detects ${id} without executing its binary`, async () => {
      const { project, home } = await environment();
      await markDetected(id, project, home);
      expect((await detection(id, project, home)).installation).toBe("installed");
    });
  }

  it("detects multiple hosts independently", async () => {
    const { project, home } = await environment();
    await markDetected("codex", project, home);
    await markDetected("cursor", project, home);
    await markDetected("claude", project, home);
    const report = await runSetup({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
      status: true,
      quiet: true,
    });
    expect(report.detections.filter((item) => item.detected).map((item) => item.id)).toEqual([
      "codex",
      "cursor",
      "claude",
    ]);
  });

  it("installs version-pinned MCP and one skill through every adapter", async () => {
    const { project, home } = await environment();
    const report = await runSetup({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
      all: true,
      yes: true,
      platform: "linux",
      quiet: true,
    });
    expect(report.verified).toBe(true);
    expect(report.results).toHaveLength(6);
    const cursor = JSON.parse(
      await readFile(path.join(project, ".cursor", "mcp.json"), "utf8"),
    ) as { mcpServers: { cydetix: { args: string[] } } };
    expect(cursor.mcpServers.cydetix.args).toContain("cydetix@0.6.0-alpha.3");
    const codex = await readFile(path.join(home, ".codex", "config.toml"), "utf8");
    expect(codex).toContain("[mcp_servers.cydetix]");
    expect(codex).toContain('"cydetix@0.6.0-alpha.3"');
    const copilot = JSON.parse(
      await readFile(path.join(project, ".vscode", "mcp.json"), "utf8"),
    ) as { servers: { cydetix: { type: string } } };
    expect(copilot.servers.cydetix.type).toBe("stdio");
  });

  it("recognizes an already configured host", async () => {
    const { project, home } = await environment();
    await runSetup({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
      agents: ["cursor"],
      yes: true,
      quiet: true,
    });
    expect((await detection("cursor", project, home)).integration).toBe("configured");
  });

  it("reports a partially configured host", async () => {
    const { project, home } = await environment();
    await markDetected("cursor", project, home);
    const config = path.join(project, ".cursor", "mcp.json");
    await mkdir(path.dirname(config), { recursive: true });
    await writeFile(
      config,
      `${JSON.stringify({ mcpServers: { cydetix: process.platform === "win32" ? { command: "cmd", args: ["/c", "npx", "--yes", "cydetix@0.6.0-alpha.3", "mcp"] } : { command: "npx", args: ["--yes", "cydetix@0.6.0-alpha.3", "mcp"] } } })}\n`,
    );
    expect((await detection("cursor", project, home)).integration).toBe("partially_configured");
  });

  it("refuses an invalid existing configuration", async () => {
    const { project, home } = await environment();
    const config = path.join(project, ".cursor", "mcp.json");
    await mkdir(path.dirname(config), { recursive: true });
    await writeFile(config, "not-json\n");
    await expect(
      runSetup({
        projectRoot: project,
        homeDirectory: home,
        executablePath: "",
        agents: ["cursor"],
        yes: true,
        quiet: true,
      }),
    ).rejects.toThrow("invalid JSON");
    expect(await readFile(config, "utf8")).toBe("not-json\n");
  });

  it("creates a transient backup during an atomic update", async () => {
    const { project } = await environment();
    const config = path.join(project, "config.json");
    await writeFile(config, "before\n");
    let observed = false;
    await atomicValidatedWrite(config, "after\n", async (_written, backup) => {
      if (backup !== undefined) {
        observed = (await readFile(backup, "utf8")) === "before\n";
      }
    });
    expect(observed).toBe(true);
    expect(await readFile(config, "utf8")).toBe("after\n");
  });

  it("commits configuration atomically and preserves unrelated entries", async () => {
    const { project, home } = await environment();
    const config = path.join(project, ".cursor", "mcp.json");
    await mkdir(path.dirname(config), { recursive: true });
    await writeFile(
      config,
      `${JSON.stringify({ theme: "dark", mcpServers: { existing: { command: "safe-tool" } } })}\n`,
    );
    await runSetup({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
      agents: ["cursor"],
      yes: true,
      quiet: true,
    });
    const after = JSON.parse(await readFile(config, "utf8")) as {
      theme: string;
      mcpServers: Record<string, unknown>;
    };
    expect(after.theme).toBe("dark");
    expect(after.mcpServers.existing).toEqual({ command: "safe-tool" });
  });

  it("rolls back and proves restoration when validation fails", async () => {
    const { project } = await environment();
    const config = path.join(project, "rollback.json");
    await writeFile(config, "original\n");
    await expect(
      atomicValidatedWrite(config, "invalid\n", () => {
        throw new Error("validation failed");
      }),
    ).rejects.toThrow("validation failed");
    expect(await readFile(config, "utf8")).toBe("original\n");
  });

  it("prevents duplicate registration", async () => {
    const { project, home } = await environment();
    await runSetup({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
      agents: ["cursor"],
      yes: true,
      quiet: true,
    });
    const repeated = await runSetup({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
      agents: ["cursor"],
      yes: true,
      quiet: true,
    });
    expect(repeated.results[0]?.action).toBe("unchanged");
  });

  it("persists a decline and does not configure the host", async () => {
    const { project, home } = await environment();
    await markDetected("cursor", project, home);
    const report = await runAutomaticIntegration({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
      interactive: true,
      confirm: () => false,
    });
    expect(report.cancelled).toBe(true);
    expect((await readIntegrationState(project))?.status).toBe("declined");
    expect((await detection("cursor", project, home)).integration).toBe("not_configured");
  });

  it("connects and verifies after one accepted prompt", async () => {
    const { project, home } = await environment();
    await markDetected("cursor", project, home);
    const report = await runAutomaticIntegration({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
      interactive: true,
      confirm: () => true,
    });
    expect(report.verified).toBe(true);
    expect(report.results).toHaveLength(1);
  });

  it("never prompts or writes in non-interactive execution", async () => {
    const { project, home } = await environment();
    await markDetected("cursor", project, home);
    let prompted = false;
    await runAutomaticIntegration({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
      interactive: false,
      confirm: () => {
        prompted = true;
        return true;
      },
    });
    expect(prompted).toBe(false);
    await expect(access(path.join(project, ".cursor", "mcp.json"))).rejects.toThrow();
  });

  it("never prompts in CI", async () => {
    const { project, home } = await environment();
    await markDetected("cursor", project, home);
    const previous = process.env.CI;
    process.env.CI = "true";
    try {
      const report = await runAutomaticIntegration({ projectRoot: project, homeDirectory: home });
      expect(report.results).toHaveLength(0);
    } finally {
      if (previous === undefined) delete process.env.CI;
      else process.env.CI = previous;
    }
  });

  it("never prompts in an MCP subprocess", async () => {
    const { project, home } = await environment();
    await markDetected("cursor", project, home);
    const previous = process.env.CYDETIX_MCP;
    process.env.CYDETIX_MCP = "1";
    try {
      const report = await runAutomaticIntegration({ projectRoot: project, homeDirectory: home });
      expect(report.results).toHaveLength(0);
    } finally {
      if (previous === undefined) delete process.env.CYDETIX_MCP;
      else process.env.CYDETIX_MCP = previous;
    }
  });

  it("reports inaccessible host configuration", async () => {
    const { project, home } = await environment();
    await mkdir(path.join(project, ".cursor", "mcp.json"), { recursive: true });
    expect((await detection("cursor", project, home)).integration).toBe(
      "configuration_inaccessible",
    );
  });

  it("reports an unsupported pinned integration version", async () => {
    const { project, home } = await environment();
    const config = path.join(project, ".cursor", "mcp.json");
    await mkdir(path.dirname(config), { recursive: true });
    await writeFile(
      config,
      `${JSON.stringify({ mcpServers: { cydetix: { command: "npx", args: ["--yes", "cydetix@99.0.0", "mcp"] } } })}\n`,
    );
    expect((await detection("cursor", project, home)).integration).toBe("unsupported_version");
  });

  it("generates a portable generic MCP config", async () => {
    const { project, home } = await environment();
    const report = await runSetup({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
      agents: ["generic-mcp"],
      yes: true,
      quiet: true,
    });
    expect(report.verified).toBe(true);
    const content = await readFile(path.join(project, ".cydetix", "mcp.json"), "utf8");
    expect(content).toContain("cydetix@0.6.0-alpha.3");
  });

  it("installs a pinned CLI fallback in host instructions", async () => {
    const { project, home } = await environment();
    await runSetup({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
      agents: ["cursor"],
      yes: true,
      quiet: true,
    });
    const rule = await readFile(path.join(project, ".cursor", "rules", "cydetix.mdc"), "utf8");
    expect(rule).toContain("npx --yes cydetix@0.6.0-alpha.3 --json");
  });

  it("removes only Cydetix-owned entries", async () => {
    const { project, home } = await environment();
    const config = path.join(project, ".cursor", "mcp.json");
    await mkdir(path.dirname(config), { recursive: true });
    await writeFile(
      config,
      `${JSON.stringify({ theme: "dark", mcpServers: { existing: { command: "safe-tool" } } })}\n`,
    );
    await runSetup({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
      agents: ["cursor"],
      yes: true,
      quiet: true,
    });
    const removed = await runSetup({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
      agents: ["cursor"],
      yes: true,
      remove: true,
      quiet: true,
    });
    expect(removed.results[0]?.action).toBe("removed");
    const after = JSON.parse(await readFile(config, "utf8")) as {
      theme: string;
      mcpServers: Record<string, unknown>;
    };
    expect(after.theme).toBe("dark");
    expect(after.mcpServers.existing).toEqual({ command: "safe-tool" });
    expect(after.mcpServers.cydetix).toBeUndefined();
  });
});
