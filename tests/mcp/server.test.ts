import { cp, mkdir, symlink } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PRODUCT } from "../../src/core/brand.js";
import {
  createMcpServerContext,
  handleMcpRequest,
  type McpServerContext,
} from "../../src/mcp/server.js";
import { temporaryDirectory } from "../helpers/temporary.js";

async function repositoryContext(): Promise<McpServerContext> {
  return createMcpServerContext({ projectRoot: ".", requiredVersion: PRODUCT.version });
}

describe("Cydetix MCP server", () => {
  it("uses the public Cydetix server identity", async () => {
    const response = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 0,
        method: "initialize",
        params: { protocolVersion: "2025-06-18" },
      },
      await repositoryContext(),
    );
    expect((response?.result as { serverInfo: { name: string } }).serverInfo.name).toBe("Cydetix");
    expect((response?.result as { capabilities: unknown }).capabilities).toEqual({
      tools: { listChanged: false },
    });
  });

  it("exposes only the three public tools", async () => {
    const response = await handleMcpRequest(
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      await repositoryContext(),
    );
    const result = response?.result as { tools: Array<{ name: string }> };
    expect(result.tools.map((tool) => tool.name)).toEqual([
      "cydetix_scan",
      "cydetix_fix",
      "cydetix_explain",
    ]);
  });

  it("runs a deterministic scan through the engine", async () => {
    const response = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "cydetix_scan",
          arguments: { path: "fixtures/typescript/vulnerable" },
        },
      },
      await repositoryContext(),
    );
    const result = response?.result as {
      structuredContent: { report: { tool: { name: string }; findings: unknown[] } };
    };
    expect(result.structuredContent.report.tool.name).toBe("cydetix");
    expect(result.structuredContent.report.findings.length).toBeGreaterThan(0);
  });

  it("rejects source mutation without confirmed explicit fix intent", async () => {
    const response = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "cydetix_fix",
          arguments: { path: "fixtures/autofix/vulnerable", apply: true },
        },
      },
      await repositoryContext(),
    );
    expect(response?.error?.message).toContain("explicit fix intent");
  });

  it("fails closed on an exact version mismatch", async () => {
    await expect(
      createMcpServerContext({ projectRoot: ".", requiredVersion: "99.0.0" }),
    ).rejects.toThrow(`required 99.0.0, running ${PRODUCT.version}`);
  });

  it("uses the explicit project root independently of cwd and rejects every escape", async () => {
    const root = await temporaryDirectory("cydetix-mcp-boundary-");
    const repositoryA = path.join(root, "repository A");
    const launchDirectoryB = path.join(root, "launch directory B");
    const siblingRepositoryC = path.join(root, "repository C");
    await Promise.all([
      cp(path.resolve("fixtures", "typescript", "vulnerable"), repositoryA, { recursive: true }),
      mkdir(launchDirectoryB, { recursive: true }),
      mkdir(siblingRepositoryC, { recursive: true }),
    ]);
    const context = await createMcpServerContext({
      projectRoot: repositoryA,
      requiredVersion: PRODUCT.version,
    });
    const call = (requestedPath: string) =>
      handleMcpRequest(
        {
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: { name: "cydetix_scan", arguments: { path: requestedPath } },
        },
        context,
      );

    const previousCwd = process.cwd();
    process.chdir(launchDirectoryB);
    try {
      const response = await call(".");
      const report = (
        response?.result as { structuredContent: { report: { findings: unknown[] } } }
      ).structuredContent.report;
      expect(report.findings.length).toBeGreaterThan(0);
      for (const outside of [
        "..",
        "../launch directory B",
        "../repository C",
        launchDirectoryB,
        "C:\\outside-drive\\repository",
        "\\\\server\\share\\repository",
        "\\\\?\\C:\\device\\repository",
        "nul\0path",
      ]) {
        expect((await call(outside))?.error?.message).toContain("configured project root");
      }

      const escape = path.join(repositoryA, "escape");
      let linked = true;
      try {
        await symlink(
          siblingRepositoryC,
          escape,
          process.platform === "win32" ? "junction" : "dir",
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EPERM") linked = false;
        else throw error;
      }
      if (linked)
        expect((await call("escape"))?.error?.message).toMatch(
          /real directory|configured project root/u,
        );
    } finally {
      process.chdir(previousCwd);
    }
  });
});
