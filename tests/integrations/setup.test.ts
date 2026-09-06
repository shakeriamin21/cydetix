import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { runSetup } from "../../src/integrations/setup.js";
import { temporaryDirectory } from "../helpers/temporary.js";

describe("universal agent setup", () => {
  it("installs version-pinned MCP and one skill through every adapter", async () => {
    const root = await temporaryDirectory("vibeshield-setup-");
    const project = path.join(root, "project");
    const home = path.join(root, "home");
    const report = await runSetup({
      projectRoot: project,
      homeDirectory: home,
      all: true,
      yes: true,
      platform: "linux",
    });
    expect(report.cancelled).toBe(false);
    expect(report.results).toHaveLength(6);
    const cursor = JSON.parse(
      await readFile(path.join(project, ".cursor", "mcp.json"), "utf8"),
    ) as { mcpServers: { vibeshield: { args: string[] } } };
    expect(cursor.mcpServers.vibeshield.args).toContain("vibeshield@0.6.0-alpha.1");
    const codex = await readFile(path.join(home, ".codex", "config.toml"), "utf8");
    expect(codex).toContain("[mcp_servers.vibeshield]");
    expect(codex).toContain('"vibeshield@0.6.0-alpha.1"');
    const skill = await readFile(
      path.join(home, ".codex", "skills", "vibeshield", "SKILL.md"),
      "utf8",
    );
    expect(skill).toContain("Never invent a finding");
    const copilot = JSON.parse(
      await readFile(path.join(project, ".vscode", "mcp.json"), "utf8"),
    ) as { servers: { vibeshield: { type: string } } };
    expect(copilot.servers.vibeshield.type).toBe("stdio");
  });

  it("previews without writes and removes only managed entries", async () => {
    const root = await temporaryDirectory("vibeshield-setup-lifecycle-");
    const project = path.join(root, "project");
    const home = path.join(root, "home");
    const preview = await runSetup({
      projectRoot: project,
      homeDirectory: home,
      agents: ["cursor"],
      yes: true,
      dryRun: true,
      platform: "linux",
    });
    expect(preview.results[0]?.action).toBe("installed");
    await expect(readFile(path.join(project, ".cursor", "mcp.json"), "utf8")).rejects.toThrow();
    await runSetup({
      projectRoot: project,
      homeDirectory: home,
      agents: ["cursor"],
      yes: true,
      platform: "linux",
    });
    const removed = await runSetup({
      projectRoot: project,
      homeDirectory: home,
      agents: ["cursor"],
      yes: true,
      uninstall: true,
      platform: "linux",
    });
    expect(removed.results[0]?.action).toBe("removed");
    const cursor = JSON.parse(
      await readFile(path.join(project, ".cursor", "mcp.json"), "utf8"),
    ) as { mcpServers: Record<string, unknown> };
    expect(cursor.mcpServers.vibeshield).toBeUndefined();
  });

  it("preserves unrelated host configuration and reconfigures idempotently", async () => {
    const root = await temporaryDirectory("vibeshield-setup-merge-");
    const project = path.join(root, "project");
    const home = path.join(root, "home");
    const config = path.join(project, ".cursor", "mcp.json");
    await mkdir(path.dirname(config), { recursive: true });
    await writeFile(
      config,
      `${JSON.stringify({ theme: "dark", mcpServers: { existing: { command: "safe-tool" } } }, null, 2)}\n`,
      "utf8",
    );
    await runSetup({
      projectRoot: project,
      homeDirectory: home,
      agents: ["cursor"],
      yes: true,
      platform: "darwin",
    });
    const repeated = await runSetup({
      projectRoot: project,
      homeDirectory: home,
      agents: ["cursor"],
      yes: true,
      platform: "darwin",
    });
    expect(repeated.results[0]?.action).toBe("unchanged");
    await runSetup({
      projectRoot: project,
      homeDirectory: home,
      agents: ["cursor"],
      yes: true,
      uninstall: true,
      platform: "darwin",
    });
    const after = JSON.parse(await readFile(config, "utf8")) as {
      theme: string;
      mcpServers: Record<string, unknown>;
    };
    expect(after.theme).toBe("dark");
    expect(after.mcpServers.existing).toEqual({ command: "safe-tool" });
    expect(after.mcpServers.vibeshield).toBeUndefined();
  });
});
