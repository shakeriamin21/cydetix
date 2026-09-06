import { describe, expect, it } from "vitest";

import { handleMcpRequest } from "../../src/mcp/server.js";

describe("Cydetix MCP server", () => {
  it("uses the public Cydetix server identity", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: { protocolVersion: "2025-06-18" },
    });
    expect((response?.result as { serverInfo: { name: string } }).serverInfo.name).toBe("Cydetix");
  });

  it("exposes only the three public tools", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });
    const result = response?.result as { tools: Array<{ name: string }> };
    expect(result.tools.map((tool) => tool.name)).toEqual([
      "cydetix_scan",
      "cydetix_fix",
      "cydetix_explain",
    ]);
  });

  it("runs a deterministic scan through the engine", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "cydetix_scan",
        arguments: { path: "fixtures/typescript/vulnerable" },
      },
    });
    const result = response?.result as {
      structuredContent: { report: { tool: { name: string }; findings: unknown[] } };
    };
    expect(result.structuredContent.report.tool.name).toBe("cydetix");
    expect(result.structuredContent.report.findings.length).toBeGreaterThan(0);
  });

  it("rejects source mutation without confirmed explicit fix intent", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "cydetix_fix",
        arguments: { path: "fixtures/autofix/vulnerable", apply: true },
      },
    });
    expect(response?.error?.message).toContain("explicit fix intent");
  });

  it("rejects project paths outside the MCP server working directory", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "cydetix_scan", arguments: { path: ".." } },
    });
    expect(response?.error?.message).toContain("must stay within");
  });
});
