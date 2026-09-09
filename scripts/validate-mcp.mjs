import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

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
const result = spawnSync(
  process.execPath,
  [
    "dist/cli/main.js",
    "mcp",
    "--project-root",
    path.resolve("."),
    "--require-version",
    packageJson.version,
  ],
  {
    input: `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 1_000_000,
  },
);
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
const mismatch = spawnSync(
  process.execPath,
  ["dist/cli/main.js", "mcp", "--project-root", path.resolve("."), "--require-version", "99.0.0"],
  {
    input: `${JSON.stringify(requests[0])}\n`,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 1_000_000,
  },
);
if (
  mismatch.error !== undefined ||
  mismatch.status === 0 ||
  mismatch.stdout !== "" ||
  !mismatch.stderr.includes("MCP version mismatch")
)
  throw new Error("MCP exact-version mismatch did not fail closed before serving requests.");
process.stdout.write(
  "Validated explicit-root Cydetix MCP initialize, exact-version startup, and three-tool stdio surface.\n",
);
