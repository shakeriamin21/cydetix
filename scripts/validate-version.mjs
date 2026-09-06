import { readFile } from "node:fs/promises";

import { PRODUCT } from "../dist/core/brand.js";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const plugin = JSON.parse(await readFile("plugins/vibeshield/.codex-plugin/plugin.json", "utf8"));
const publication = JSON.parse(await readFile("release/publication-config.json", "utf8"));
const sourceBrand = await readFile("src/core/brand.ts", "utf8");
const readme = await readFile("README.md", "utf8");
const changelog = await readFile("CHANGELOG.md", "utf8");
const releaseNotes = await readFile(`docs/releases/v${packageJson.version}.md`, "utf8");
const versions = new Map([
  ["package", packageJson.version],
  ["lock", lock.version],
  ["lock-root", lock.packages?.[""]?.version],
  ["cli", PRODUCT.version],
  ["plugin", plugin.version],
  ["publication", publication.version],
]);
for (const [source, version] of versions)
  if (version !== packageJson.version)
    throw new Error(`Version mismatch: ${source} has ${String(version)}.`);
if (packageJson.engines?.node !== lock.packages?.[""]?.engines?.node)
  throw new Error("Package and lockfile Node engine ranges differ.");
for (const [source, content] of [
  ["source brand", sourceBrand],
  ["README", readme],
  ["CHANGELOG", changelog],
  ["release notes", releaseNotes],
]) {
  if (!content.includes(packageJson.version))
    throw new Error(`Version mismatch: ${source} does not name ${packageJson.version}.`);
}
for (const skillRoot of ["agent-skills", "plugins/vibeshield/skills"]) {
  const content = await readFile(`${skillRoot}/vibeshield/SKILL.md`, "utf8");
  if (!content.includes("name: vibeshield"))
    throw new Error(`Skill identity mismatch: ${skillRoot}/vibeshield/SKILL.md.`);
}
if (publication.tagCandidate !== `v${packageJson.version}`)
  throw new Error("Publication tag candidate does not match the package version.");
const expectedTag = process.env.VIBESHIELD_EXPECTED_TAG;
if (expectedTag !== undefined && expectedTag !== `v${packageJson.version}`)
  throw new Error(`Release tag ${expectedTag} does not match package v${packageJson.version}.`);
process.stdout.write(
  `Version consistency verified: ${packageJson.version}; Node ${packageJson.engines.node}.\n`,
);
