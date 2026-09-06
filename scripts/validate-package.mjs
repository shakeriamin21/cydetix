import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const cache = path.resolve(".npm-cache");
const npmCli = process.env.npm_execpath;
if (npmCli === undefined) throw new Error("npm_execpath is required; invoke through npm run.");
const packed = spawnSync(
  process.execPath,
  [npmCli, "pack", "--json", "--dry-run", "--ignore-scripts"],
  {
    cwd: path.resolve("."),
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: 5_000_000,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      PATHEXT: process.env.PATHEXT,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      npm_config_cache: cache,
      NO_UPDATE_NOTIFIER: "1",
    },
  },
);
if (packed.error !== undefined || packed.status !== 0)
  throw new Error("npm package manifest dry-run failed.");
const entries = JSON.parse(packed.stdout);
const manifest = entries[0];
if (manifest === undefined || !Array.isArray(manifest.files))
  throw new Error("npm pack did not return a package manifest.");
const allowedRoots = new Set([
  "CHANGELOG.md",
  "LICENSE",
  "NOTICE",
  "README.md",
  "agent-skills",
  "dist",
  "package.json",
  "rules",
  "schemas",
]);
const forbiddenPath =
  /^(?:fixtures|tests|validation|\.git|\.vibeshield|\.vibeshield|coverage)(?:\/|$)|(?:^|\/)node_modules(?:\/|$)|\.(?:env|key|pem|p12)$/iu;
const forbiddenContent = [
  ["Z:", "private-workspace-sentinel"].join("\\"),
  ["C:", "Users", "synthetic-user"].join("\\"),
  ["Codex", "Sandbox", "Offline"].join(""),
  ["vibeshield", "phase6", "cache"].join("-"),
];
for (const file of manifest.files) {
  const normalized = String(file.path).replaceAll("\\", "/");
  const root = normalized.split("/")[0];
  if (!allowedRoots.has(root) || forbiddenPath.test(normalized))
    throw new Error(`Unexpected package artifact path: ${normalized}`);
  const absolute = path.resolve(normalized);
  const content = await readFile(absolute).catch(() => undefined);
  if (content === undefined) throw new Error(`Package artifact is unreadable: ${normalized}`);
  if (content.length <= 5_000_000) {
    const text = content.toString("utf8");
    for (const needle of forbiddenContent) {
      if (text.includes(needle)) throw new Error(`Developer-specific content in ${normalized}`);
    }
  }
}
if (manifest.size > 400_000)
  throw new Error(`Packed size ${manifest.size} exceeds the 400000-byte release gate.`);
if (manifest.unpackedSize > 2_500_000)
  throw new Error(`Unpacked size ${manifest.unpackedSize} exceeds the release gate.`);
const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
for (const name of ["preinstall", "install", "postinstall", "prepare"])
  if (packageJson.scripts?.[name] !== undefined)
    throw new Error(`Package lifecycle script is forbidden: ${name}`);
process.stdout.write(
  `Validated ${manifest.entryCount} package entries; ${manifest.size} packed bytes; ${manifest.unpackedSize} unpacked bytes.\n`,
);
