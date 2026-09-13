import { describe, expect, it } from "vitest";
import { boundedMcpLines, createMcpServerContext, handleMcpRequest } from "../../src/mcp/server.js";

describe("alpha.12 MCP strict contract", () => {
  it.each([
    ["cydetix_scan", null],
    ["cydetix_scan", []],
    ["cydetix_scan", "path"],
    ["cydetix_scan", { network: true }],
    ["cydetix_scan", { path: 1 }],
    ["cydetix_scan", { path: "" }],
    ["cydetix_fix", { apply: "true" }],
    ["cydetix_fix", { apply: 1 }],
    ["cydetix_fix", { command: "node" }],
    ["cydetix_fix", { confirmedUserIntent: "scan" }],
    ["cydetix_explain", { finding: false }],
    ["cydetix_explain", {}],
  ])("rejects malformed %s arguments before acting", async (name, arguments_) => {
    const result = await handleMcpRequest(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: arguments_ } },
      await createMcpServerContext(),
    );
    expect(result?.error?.code).toBe(-32602);
    expect(result?.result).toBeUndefined();
  });

  it("bounds unterminated input and recovers for the next request", async () => {
    async function* chunks() {
      await Promise.resolve();
      for (let index = 0; index < 40; index++) yield "x".repeat(65_536);
      yield '\n{"jsonrpc":"2.0","id":2,"method":"ping"}\n';
      yield "last";
    }
    const lines = [];
    for await (const line of boundedMcpLines(chunks())) lines.push(line);
    expect(lines).toEqual([null, '{"jsonrpc":"2.0","id":2,"method":"ping"}', "last"]);
  });

  it("rejects stale evidence with an actionable rescan instruction", async () => {
    const result = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "cydetix_explain",
          arguments: { path: "fixtures/typescript/secure", finding: "0".repeat(64) },
        },
      },
      await createMcpServerContext(),
    );
    expect(result?.error?.message).toContain("Rescan the same project");
  });
});
