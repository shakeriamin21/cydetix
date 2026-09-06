import { spawnSync } from "node:child_process";

const requests = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "validator", version: "1" },
    },
  },
  { jsonrpc: "2.0", method: "notifications/initialized" },
  { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
];
const result = spawnSync(process.execPath, ["dist/cli/main.js", "mcp"], {
  input: `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`,
  encoding: "utf8",
  shell: false,
  windowsHide: true,
  timeout: 30_000,
  maxBuffer: 1_000_000,
});
if (result.error !== undefined || result.status !== 0)
  throw new Error(`MCP stdio validation failed: ${String(result.stderr).slice(-500)}`);
const responses = result.stdout
  .trim()
  .split(/\r?\n/u)
  .map((line) => JSON.parse(line));
if (responses.length !== 2) throw new Error("MCP server returned an unexpected response count.");
if (responses[0]?.result?.serverInfo?.name !== "Cydetix")
  throw new Error("MCP initialize identity mismatch.");
const names = responses[1]?.result?.tools?.map((tool) => tool.name);
if (JSON.stringify(names) !== JSON.stringify(["cydetix_scan", "cydetix_fix", "cydetix_explain"]))
  throw new Error("MCP public tool surface mismatch.");
process.stdout.write("Validated Cydetix MCP initialize and three-tool stdio surface.\n");
