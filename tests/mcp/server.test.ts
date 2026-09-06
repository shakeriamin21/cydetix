import { describe, expect, it } from "vitest";

import { handleMcpRequest } from "../../src/mcp/server.js";

describe("VibeShield MCP server", () => {
  it("exposes only the three public tools", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });
    const result = response?.result as { tools: Array<{ name: string }> };
    expect(result.tools.map((tool) => tool.name)).toEqual([
      "vibeshield_scan",
      "vibeshield_fix",
      "vibeshield_explain",
    ]);
  });

  it("runs a deterministic scan through the engine", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "vibeshield_scan",
        arguments: { path: "fixtures/typescript/vulnerable" },
      },
    });
    const result = response?.result as {
      structuredContent: { report: { tool: { name: string }; findings: unknown[] } };
    };
    expect(result.structuredContent.report.tool.name).toBe("vibeshield");
    expect(result.structuredContent.report.findings.length).toBeGreaterThan(0);
  });

  it("rejects source mutation without confirmed explicit fix intent", async () => {
    const response = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "vibeshield_fix",
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
      params: { name: "vibeshield_scan", arguments: { path: ".." } },
    });
    expect(response?.error?.message).toContain("must stay within");
  });
});
