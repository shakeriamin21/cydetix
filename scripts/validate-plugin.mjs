import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const pluginRoot = path.resolve("plugins", "vibeshield");
const manifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
const raw = await readFile(manifestPath, "utf8");
const packageManifest = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
const marketplace = JSON.parse(
  await readFile(path.resolve(".agents", "plugins", "marketplace.json"), "utf8"),
);
if (raw.includes("[TODO:")) throw new Error("Plugin manifest contains an unfinished placeholder.");
const manifest = JSON.parse(raw);
if (manifest.name !== path.basename(pluginRoot))
  throw new Error("Plugin name must match its folder.");
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.version)) {
  throw new Error("Plugin version is not valid semver.");
}
if (manifest.version !== packageManifest.version) {
  throw new Error("Plugin and CLI package versions must match.");
}
if (marketplace.name !== "vibeshield" || marketplace.interface?.displayName !== "VibeShield") {
  throw new Error("Repository plugin catalog identity is invalid.");
}
if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length !== 1) {
  throw new Error("Repository plugin catalog must contain exactly one plugin.");
}
const marketplaceEntry = marketplace.plugins[0];
if (
  marketplaceEntry.name !== manifest.name ||
  marketplaceEntry.source?.source !== "local" ||
  marketplaceEntry.source?.path !== "./plugins/vibeshield" ||
  marketplaceEntry.policy?.installation !== "AVAILABLE" ||
  marketplaceEntry.policy?.authentication !== "ON_INSTALL" ||
  typeof marketplaceEntry.category !== "string"
) {
  throw new Error("Repository plugin catalog entry is invalid.");
}
for (const field of ["description", "author", "interface", "skills", "mcpServers"]) {
  if (manifest[field] === undefined) throw new Error(`Plugin manifest is missing ${field}.`);
}
if (manifest.apps !== undefined) throw new Error("Plugin must not declare an absent app.");
const mcpPath = path.resolve(pluginRoot, manifest.mcpServers);
const mcp = JSON.parse(await readFile(mcpPath, "utf8"));
const server = mcp.mcpServers?.vibeshield;
if (
  server?.command !== "npx" ||
  JSON.stringify(server.args) !==
    JSON.stringify(["--yes", `vibeshield@${packageManifest.version}`, "mcp"])
)
  throw new Error("Plugin MCP command must be pinned to the plugin/package version.");
const skillsPath = path.resolve(pluginRoot, manifest.skills);
if (!(await stat(skillsPath)).isDirectory()) throw new Error("Plugin skills path does not exist.");
const skillNames = (await readdir(skillsPath, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
if (JSON.stringify(skillNames) !== JSON.stringify(["vibeshield"]))
  throw new Error("Plugin must expose exactly one vibeshield skill.");
const [rootLicense, pluginLicense] = await Promise.all([
  readFile(path.resolve("LICENSE"), "utf8"),
  readFile(path.join(pluginRoot, "LICENSE"), "utf8"),
]);
if (pluginLicense !== rootLicense) {
  throw new Error("Plugin LICENSE must be byte-identical to the repository LICENSE.");
}
for (const noticePath of [path.resolve("NOTICE"), path.join(pluginRoot, "NOTICE")]) {
  if (!(await stat(noticePath)).isFile()) {
    throw new Error(`Required NOTICE file does not exist: ${noticePath}`);
  }
}
process.stdout.write(`Validated plugin manifest: ${manifestPath}\n`);
