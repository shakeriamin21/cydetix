import { spawnSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const pluginManifest = JSON.parse(
  await readFile("plugins/cydetix/.codex-plugin/plugin.json", "utf8"),
);
const releaseDirectory = process.env.CYDETIX_RELEASE_DIR ?? path.join(".cydetix", "release");
const archive = path.resolve(
  releaseDirectory,
  `${pluginManifest.name}-codex-plugin-${packageJson.version}.tar.gz`,
);
if (!(await stat(archive)).isFile())
  throw new Error("Build release artifacts before validating the packed plugin.");
const temporary = await mkdtemp(path.join(os.tmpdir(), "cydetix-plugin-install-"));

async function inspectTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    const metadata = await lstat(target);
    if (metadata.isSymbolicLink()) throw new Error("Packed plugin must not contain symlinks.");
    if (metadata.isDirectory()) {
      await inspectTree(target);
      continue;
    }
    if (!metadata.isFile() || metadata.size > 5_000_000)
      throw new Error("Packed plugin contains an unsupported artifact.");
    const content = await readFile(target, "utf8");
    for (const forbidden of [
      ["Z:", "private-workspace-sentinel"].join("\\"),
      ["C:", "Users", "synthetic-user"].join("\\"),
      ["Codex", "Sandbox", "Offline"].join(""),
    ])
      if (content.includes(forbidden))
        throw new Error(`Packed plugin contains developer-specific content: ${entry.name}`);
  }
}

try {
  const extraction = spawnSync("tar", ["-xzf", archive, "-C", temporary], {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 1_000_000,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      PATHEXT: process.env.PATHEXT,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
    },
  });
  if (extraction.error !== undefined || extraction.status !== 0)
    throw new Error("Packed plugin extraction failed safely.");
  const root = path.join(temporary, "cydetix");
  await inspectTree(root);
  const manifest = JSON.parse(
    await readFile(path.join(root, ".codex-plugin", "plugin.json"), "utf8"),
  );
  if (manifest.name !== "cydetix" || manifest.version !== packageJson.version)
    throw new Error("Packed plugin identity/version mismatch.");
  for (const required of ["LICENSE", "NOTICE", "README.md"])
    if (!(await stat(path.join(root, required))).isFile())
      throw new Error(`Packed plugin is missing ${required}.`);
  const skillsRoot = path.resolve(root, manifest.skills);
  const skills = (await readdir(skillsRoot, { withFileTypes: true })).filter((entry) =>
    entry.isDirectory(),
  );
  if (skills.length !== 1 || skills[0]?.name !== "cydetix")
    throw new Error("Packed plugin skill inventory mismatch.");
  for (const entry of skills) {
    const skill = await readFile(path.join(skillsRoot, entry.name, "SKILL.md"), "utf8");
    if (!skill.startsWith("---\n") || !skill.includes(`name: ${entry.name}`))
      throw new Error(`Packed plugin skill is invalid: ${entry.name}`);
  }
  const evidenceDirectory = path.resolve(".cydetix", "evidence");
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(
    path.join(evidenceDirectory, "packed-plugin.json"),
    `${JSON.stringify(
      {
        schemaVersion: "1.0.0",
        state: "PASSED",
        version: manifest.version,
        skillCount: skills.length,
        isolatedExtraction: true,
        developerPathsAbsent: true,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  process.stdout.write(
    `Packed Codex plugin ${manifest.version} validated from an isolated extraction (${skills.length} skills).\n`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
