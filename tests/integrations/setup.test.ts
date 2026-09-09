import { access, mkdir, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  atomicValidatedWrite,
  createTrustedIntegrationRoot,
  pinnedMcpServer,
  readRegularFile,
  resolveTrustedIntegrationPath,
} from "../../src/integrations/common.js";
import { isEphemeralNpxPath, PERSISTENT_RUNTIME_REQUIRED } from "../../src/integrations/runtime.js";
import {
  integrationContext,
  INTEGRATION_ADAPTERS,
  parseAgentSelector,
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
    gemini: path.join(home, ".gemini"),
    cline: path.join(home, ".cline"),
    roo: path.join(home, ".roo"),
    continue: path.join(home, ".continue"),
    goose: path.join(home, ".config", "goose"),
  };
  await mkdir(targets[id], { recursive: true });
}

async function detection(id: AgentId, project: string, home: string) {
  const adapter = INTEGRATION_ADAPTERS.find((candidate) => candidate.id === id);
  if (adapter === undefined) throw new Error(`Missing adapter: ${id}`);
  return adapter.detect(
    await integrationContext({
      projectRoot: project,
      homeDirectory: home,
      executablePath: "",
      platform: process.platform,
    }),
  );
}

async function directorySymlink(target: string, link: string): Promise<boolean> {
  try {
    await symlink(target, link, process.platform === "win32" ? "junction" : "dir");
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EPERM") return false;
    throw error;
  }
}

async function withoutCi<T>(callback: () => Promise<T>): Promise<T> {
  const previous = process.env.CI;
  delete process.env.CI;
  try {
    return await callback();
  } finally {
    if (previous === undefined) delete process.env.CI;
    else process.env.CI = previous;
  }
}

describe("universal agent setup", () => {
  it("accepts auto, all, and documented host aliases", () => {
    expect(parseAgentSelector("auto")).toBe("auto");
    expect(parseAgentSelector("all")).toBe("all");
    expect(parseAgentSelector("gemini-cli")).toBe("gemini");
    expect(parseAgentSelector("roo-code")).toBe("roo");
    expect(parseAgentSelector("continue-dev")).toBe("continue");
  });

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
    for (const fixture of [
      {
        platform: "Windows",
        projectRoot: "C:\\Users\\Test User\\Projects\\Secure App",
        packageRoot: "C:\\Program Files\\nodejs\\node_modules\\cydetix",
        nodeExecutable: "C:\\Program Files\\nodejs\\node.exe",
        entrypoint: "C:\\Program Files\\nodejs\\node_modules\\cydetix\\dist\\cli\\main.js",
      },
      {
        platform: "Linux",
        projectRoot: "/home/test-user/Projects/Secure App",
        packageRoot: "/usr/local/lib/node_modules/cydetix",
        nodeExecutable: "/usr/local/bin/node",
        entrypoint: "/usr/local/lib/node_modules/cydetix/dist/cli/main.js",
      },
      {
        platform: "macOS",
        projectRoot: "/Users/Test User/Projects/Secure App",
        packageRoot: "/opt/homebrew/lib/node_modules/cydetix",
        nodeExecutable: "/opt/homebrew/bin/node",
        entrypoint: "/opt/homebrew/lib/node_modules/cydetix/dist/cli/main.js",
      },
    ]) {
      const context = {
        projectRoot: fixture.projectRoot,
        packageVersion: "0.6.0-alpha.7",
        runtime: {
          packageRoot: fixture.packageRoot,
          packageJsonPath: `${fixture.packageRoot}/package.json`,
          nodeExecutable: fixture.nodeExecutable,
          entrypoint: fixture.entrypoint,
          version: "0.6.0-alpha.7",
          source: "current-installation" as const,
        },
      };
      const server = pinnedMcpServer(context);
      expect(server).toEqual({
        command: fixture.nodeExecutable,
        args: [
          fixture.entrypoint,
          "mcp",
          "--project-root",
          fixture.projectRoot,
          "--require-version",
          "0.6.0-alpha.7",
        ],
      });
      const generated = JSON.stringify(server).toLowerCase();
      expect(generated).not.toMatch(/\bnpx\b|\bnpm\b|registry\./u);
      expect(fixture.platform).toMatch(/Windows|Linux|macOS/u);
    }
  });

  for (const id of [
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
  ] as const) {
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
      "claude",
      "cursor",
    ]);
  });

  it("installs version-pinned MCP through every safely configurable adapter", async () => {
    const { project, home } = await environment();
    await Promise.all([
      markDetected("codex", project, home),
      markDetected("cline", project, home),
      markDetected("goose", project, home),
    ]);
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
    expect(report.results).toHaveLength(10);
    expect(report.selected).not.toContain("generic-mcp");
    const cursor = JSON.parse(
      await readFile(path.join(project, ".cursor", "mcp.json"), "utf8"),
    ) as { mcpServers: { cydetix: { args: string[] } } };
    expect(cursor.mcpServers.cydetix.args).toEqual(
      expect.arrayContaining([
        "mcp",
        "--project-root",
        project,
        "--require-version",
        "0.6.0-alpha.7",
      ]),
    );
    const codex = await readFile(path.join(home, ".codex", "config.toml"), "utf8");
    expect(codex).toContain("[mcp_servers.cydetix]");
    expect(codex).toContain('"--require-version"');
    expect(codex).toContain('"0.6.0-alpha.7"');
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
      `${JSON.stringify({ mcpServers: { cydetix: { command: "cydetix", args: ["mcp"] } } })}\n`,
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
    const boundary = await createTrustedIntegrationRoot(project);
    const config = path.join(project, "config.json");
    await writeFile(config, "before\n");
    let observed = false;
    await atomicValidatedWrite(boundary, config, "after\n", async (_written, backup) => {
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
    const boundary = await createTrustedIntegrationRoot(project);
    const config = path.join(project, "rollback.json");
    await writeFile(config, "original\n");
    await expect(
      atomicValidatedWrite(boundary, config, "invalid\n", () => {
        throw new Error("validation failed");
      }),
    ).rejects.toThrow("validation failed");
    expect(await readFile(config, "utf8")).toBe("original\n");
  });

  it("does not require user-home access for an explicit project-only MCP setup", async () => {
    const { project, root } = await environment("cydetix-project-only-");
    const inaccessibleHome = path.join(root, "home-does-not-exist");
    const report = await runSetup({
      projectRoot: project,
      homeDirectory: inaccessibleHome,
      executablePath: "",
      agents: ["generic-mcp"],
      yes: true,
      quiet: true,
    });

    expect(report.verified).toBe(true);
    expect(await readFile(path.join(project, ".cydetix", "mcp.json"), "utf8")).toContain(
      "--project-root",
    );
    await expect(access(inaccessibleHome)).rejects.toThrow();
  });

  it("accepts a canonical system alias above the trusted integration root", async () => {
    const { root } = await environment("cydetix-macos-alias-");
    const canonicalParent = path.join(root, "private", "var");
    const alias = path.join(root, "var");
    const canonicalProject = path.join(canonicalParent, "folders", "project");
    await mkdir(canonicalProject, { recursive: true });
    if (!(await directorySymlink(canonicalParent, alias))) return;

    const requestedProject = path.join(alias, "folders", "project");
    const boundary = await createTrustedIntegrationRoot(requestedProject);
    const requestedTarget = path.join(requestedProject, ".cydetix", "mcp.json");
    const report = await runSetup({
      projectRoot: requestedProject,
      homeDirectory: path.join(root, "home"),
      executablePath: "",
      agents: ["generic-mcp"],
      yes: true,
      quiet: true,
    });

    expect(report.verified).toBe(true);
    expect(boundary.root).toBe(await realpath(requestedProject));
    expect(resolveTrustedIntegrationPath(boundary, requestedTarget)).toBe(
      path.join(boundary.root, ".cydetix", "mcp.json"),
    );
    expect(await readFile(path.join(canonicalProject, ".cydetix", "mcp.json"), "utf8")).toContain(
      "--require-version",
    );
  });

  it("rejects targets outside their explicit integration boundary", async () => {
    const { project, root } = await environment();
    const boundary = await createTrustedIntegrationRoot(project);
    const outside = path.join(root, "outside.json");
    expect(() => resolveTrustedIntegrationPath(boundary, outside)).toThrow(/trusted root/);
    await expect(
      atomicValidatedWrite(boundary, outside, "escape\n", () => undefined),
    ).rejects.toThrow(/trusted root/);
    await expect(access(outside)).rejects.toThrow();
  });

  it("rejects an attacker-created symlink ancestor below the trusted root", async () => {
    const { project, root } = await environment();
    const outside = path.join(root, "outside");
    const linkedParent = path.join(project, "linked-parent");
    await mkdir(outside);
    if (!(await directorySymlink(outside, linkedParent))) return;
    const boundary = await createTrustedIntegrationRoot(project);

    await expect(
      atomicValidatedWrite(
        boundary,
        path.join(linkedParent, "config.json"),
        "escape\n",
        () => undefined,
      ),
    ).rejects.toThrow(/unsafe parent/);
    await expect(access(path.join(outside, "config.json"))).rejects.toThrow();
  });

  it("rejects an existing target symlink", async () => {
    const { project, root } = await environment();
    const outside = path.join(root, "outside-target");
    const linkedTarget = path.join(project, "config.json");
    await mkdir(outside);
    if (!(await directorySymlink(outside, linkedTarget))) return;
    const boundary = await createTrustedIntegrationRoot(project);

    await expect(readRegularFile(boundary, linkedTarget)).rejects.toThrow(
      /unsafe integration file/,
    );
    await expect(
      atomicValidatedWrite(boundary, linkedTarget, "replacement\n", () => undefined),
    ).rejects.toThrow(/unsafe integration file/);
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
    await withoutCi(async () => {
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
      expect(
        (await readIntegrationState(await createTrustedIntegrationRoot(project)))?.status,
      ).toBe("declined");
      expect((await detection("cursor", project, home)).integration).toBe("not_configured");
    });
  });

  it("connects and verifies after one accepted prompt", async () => {
    await withoutCi(async () => {
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

  it("never detects, prompts, or mutates integration state in an agent subprocess", async () => {
    const { project, home } = await environment();
    await markDetected("cursor", project, home);
    const previous = process.env.CYDETIX_AGENT_SUBPROCESS;
    process.env.CYDETIX_AGENT_SUBPROCESS = "1";
    let prompted = false;
    try {
      const report = await runAutomaticIntegration({
        projectRoot: project,
        homeDirectory: home,
        interactive: true,
        confirm: () => {
          prompted = true;
          return true;
        },
      });
      expect(report.results).toHaveLength(0);
      expect(prompted).toBe(false);
      await expect(access(path.join(project, ".cursor", "mcp.json"))).rejects.toThrow();
      await expect(
        access(path.join(project, ".cydetix", "integration-state.json")),
      ).rejects.toThrow();
    } finally {
      if (previous === undefined) delete process.env.CYDETIX_AGENT_SUBPROCESS;
      else process.env.CYDETIX_AGENT_SUBPROCESS = previous;
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

  it("generates a project-bound generic MCP config", async () => {
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
    expect(content).toContain('"--project-root"');
    expect(content).toContain('"--require-version"');
    expect(content).toContain("0.6.0-alpha.7");
  });

  it("removes a configured generic integration and state without requiring agent selection", async () => {
    const { project, home } = await environment();
    await runSetup({
      projectRoot: project,
      homeDirectory: home,
      agents: ["generic-mcp"],
      yes: true,
      quiet: true,
    });
    const config = path.join(project, ".cydetix", "mcp.json");
    const state = path.join(project, ".cydetix", "integration-state.json");
    expect(await readFile(config, "utf8")).toContain("--require-version");
    expect(await readFile(state, "utf8")).toContain("nodeExecutable");

    const report = await runSetup({
      projectRoot: project,
      homeDirectory: home,
      remove: true,
      yes: true,
      quiet: true,
    });
    expect(report.selected).toContain("generic-mcp");
    const after = JSON.parse(await readFile(config, "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    expect(after.mcpServers.cydetix).toBeUndefined();
    await expect(access(state)).rejects.toThrow();
  });

  it("installs an exact direct CLI fallback in host instructions", async () => {
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
    expect(rule).toContain("Exact agent subprocess invocation (process API, no shell)");
    expect(rule).toContain(JSON.stringify(process.execPath));
    expect(rule).toContain("CYDETIX_AGENT_SUBPROCESS");
    expect(rule).not.toContain("npx --yes");
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
    await expect(
      access(path.join(project, ".cydetix", "integration-state.json")),
    ).rejects.toThrow();
  });

  it("recognizes and rejects ephemeral npx runtime locations", () => {
    expect(isEphemeralNpxPath(path.join("cache", "_npx", "123", "node_modules", "cydetix"))).toBe(
      true,
    );
    expect(PERSISTENT_RUNTIME_REQUIRED).toContain("persistent local Cydetix installation");
  });
});
