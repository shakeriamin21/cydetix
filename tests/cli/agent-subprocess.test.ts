import { spawnSync } from "node:child_process";
import { access, cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { temporaryDirectory } from "../helpers/temporary.js";

interface AgentResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error?: Error;
}

async function runAgentScan(
  format: "json" | "sarif",
  targetOverride?: string,
): Promise<{ result: AgentResult; project: string; forbiddenMarker: string }> {
  const root = await temporaryDirectory("cydetix-agent-subprocess-");
  const project = path.join(root, "Secure App");
  const launchDirectory = path.join(root, "Unrelated Host Directory");
  const fakePath = path.join(root, "fake-path");
  const forbiddenMarker = path.join(root, "package-manager-spawned");
  await Promise.all([
    cp(path.resolve("fixtures", "typescript", "vulnerable"), project, { recursive: true }),
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

  const spawned = spawnSync(
    process.execPath,
    [
      path.resolve("node_modules", "tsx", "dist", "cli.mjs"),
      path.resolve("src", "cli", "main.ts"),
      "scan",
      targetOverride ?? project,
      "--offline",
      "--format",
      format,
      "--non-interactive",
    ],
    {
      cwd: launchDirectory,
      input: "",
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
    },
  );
  return {
    result: {
      status: spawned.status,
      stdout: spawned.stdout,
      stderr: spawned.stderr,
      ...(spawned.error === undefined ? {} : { error: spawned.error }),
    },
    project,
    forbiddenMarker,
  };
}

describe("agent-safe CLI subprocess", () => {
  it("returns strict JSON without PATH, TTY, network, package managers, or auto-setup", async () => {
    const { result, project, forbiddenMarker } = await runAgentScan("json");
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as { tool: { name: string }; findings: unknown[] };
    expect(report.tool.name).toBe("cydetix");
    expect(report.findings.length).toBeGreaterThan(0);
    expect(result.stdout.endsWith("\n")).toBe(true);
    expect(result.stdout).not.toMatch(/Cydetix\s*Setup|Scanning project/u);
    expect(result.stdout).not.toContain("\u001b[");
    expect(result.stderr).toBe("");
    await expect(
      access(path.join(project, ".cydetix", "integration-state.json")),
    ).rejects.toThrow();
    await expect(access(path.join(project, ".cursor", "mcp.json"))).rejects.toThrow();
    await expect(access(forbiddenMarker)).rejects.toThrow();
  });

  it("returns SARIF only and terminates with piped stdio", async () => {
    const { result } = await runAgentScan("sarif");
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const sarif = JSON.parse(result.stdout) as { version: string; runs: unknown[] };
    expect(sarif.version).toBe("2.1.0");
    expect(Array.isArray(sarif.runs)).toBe(true);
    expect(result.stderr).toBe("");
  });

  it("fails deterministically with diagnostics only on stderr and no partial JSON", async () => {
    const root = await temporaryDirectory("cydetix-agent-missing-");
    const missing = path.join(root, "missing repository");
    const { result } = await runAgentScan("json", missing);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(3);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/Cannot inspect target path/u);
    expect(result.stderr.endsWith("\n")).toBe(true);
    expect(result.stderr).not.toContain("\u001b[");
  });
});
