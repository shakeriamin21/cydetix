import { spawnSync } from "node:child_process";
import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PRODUCT } from "../../src/core/brand.js";
import { runSetup } from "../../src/integrations/setup.js";
import { temporaryDirectory } from "../helpers/temporary.js";

interface McpConfig {
  readonly mcpServers: {
    readonly cydetix: { readonly command: string; readonly args: readonly string[] };
  };
}

describe("generated agent runtime launch", () => {
  it("starts exact Node plus exact JS with no global npm bin, package manager, network, or cwd trust", async () => {
    const root = await temporaryDirectory("cydetix-agent-launch-");
    const project = path.join(root, "Project With Spaces");
    const home = path.join(root, "Agent Home");
    const launchDirectory = path.join(root, "Unrelated Launch Directory");
    const fakePath = path.join(root, "No Global Npm Bin");
    const forbiddenMarker = path.join(root, "forbidden-process-started");
    await Promise.all([
      cp(path.resolve("fixtures", "typescript", "vulnerable"), project, { recursive: true }),
      mkdir(home, { recursive: true }),
      mkdir(launchDirectory, { recursive: true }),
      mkdir(fakePath, { recursive: true }),
    ]);
    for (const command of ["npm", "npx", "curl", "wget"]) {
      await writeFile(
        path.join(fakePath, process.platform === "win32" ? `${command}.cmd` : command),
        process.platform === "win32"
          ? `@echo forbidden>${JSON.stringify(forbiddenMarker)}\r\n@exit /b 91\r\n`
          : `#!/bin/sh\nprintf forbidden > ${JSON.stringify(forbiddenMarker)}\nexit 91\n`,
        { mode: 0o700 },
      );
    }

    const setup = await runSetup({
      projectRoot: project,
      homeDirectory: home,
      agents: ["generic-mcp"],
      yes: true,
      quiet: true,
      executablePath: "",
    });
    expect(setup.verified).toBe(true);
    const config = JSON.parse(
      await readFile(path.join(project, ".cydetix", "mcp.json"), "utf8"),
    ) as McpConfig;
    const server = config.mcpServers.cydetix;
    expect(server.command).toBe(path.resolve(process.execPath));
    expect(server.args).toEqual([
      expect.stringMatching(/[\\/]dist[\\/]cli[\\/]main\.js$/u),
      "mcp",
      "--project-root",
      project,
      "--require-version",
      PRODUCT.version,
    ]);
    expect(JSON.stringify(server).toLowerCase()).not.toMatch(/\bnpx\b|\bnpm\b|registry\./u);

    const request = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "cydetix_scan", arguments: { path: "." } },
    };
    const result = spawnSync(server.command, server.args, {
      cwd: launchDirectory,
      input: `${JSON.stringify(request)}\n`,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 25_000_000,
      env: {
        CYDETIX_AGENT_SUBPROCESS: "1",
        PATH: fakePath,
        SystemRoot: process.env.SystemRoot,
        PATHEXT: process.env.PATHEXT,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
      },
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const response = JSON.parse(result.stdout) as {
      result: { structuredContent: { report: { findings: unknown[] } } };
    };
    expect(response.result.structuredContent.report.findings.length).toBeGreaterThan(0);
    await expect(access(forbiddenMarker)).rejects.toThrow();
  });
});
