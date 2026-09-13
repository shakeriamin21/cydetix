import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import path from "node:path";

// Transparent observation of the exact local MCP process. This does not emulate a host.
const [host, projectRoot] = process.argv.slice(2);
if (!["codex", "claude"].includes(host) || !projectRoot) throw new Error("Invalid relay arguments");
const root = path.resolve(import.meta.dirname, "..");
const log = path.join(root, `.cydetix/alpha12/closure/live-host/${host}.protocol.jsonl`);
let bytes = 0;
const record = (direction, chunk) => {
  bytes += chunk.length;
  if (bytes > 4_194_304) {
    child.kill();
    throw new Error("Live-host evidence bound exceeded");
  }
  appendFileSync(log, `${JSON.stringify({ direction, text: chunk.toString("utf8") })}\n`);
};
const child = spawn(
  process.execPath,
  [
    path.join(root, "dist/cli/main.js"),
    "mcp",
    "--project-root",
    projectRoot,
    "--require-version",
    "0.6.0-alpha.12",
  ],
  {
    shell: false,
    windowsHide: true,
    env: {
      PATH: "",
      SystemRoot: process.env.SystemRoot,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      CYDETIX_AGENT_SUBPROCESS: "1",
    },
  },
);
process.stdin.on("data", (chunk) => {
  record("request", chunk);
  child.stdin.write(chunk);
});
process.stdin.on("end", () => child.stdin.end());
child.stdout.on("data", (chunk) => {
  record("response", chunk);
  process.stdout.write(chunk);
});
child.stderr.on("data", (chunk) => {
  record("stderr", chunk);
  process.stderr.write(chunk);
});
child.on("error", () => {
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
process.on("exit", () => child.kill());
