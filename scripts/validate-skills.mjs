import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("agent-skills");
const pluginRoot = path.resolve("plugins", "vibeshield", "skills");
const entries = (await readdir(root, { withFileTypes: true })).filter((entry) =>
  entry.isDirectory(),
);
if (entries.length !== 1 || entries[0]?.name !== "vibeshield")
  throw new Error("The public skill inventory must expose exactly one vibeshield capability.");

for (const entry of entries) {
  const skillPath = path.join(root, entry.name, "SKILL.md");
  const pluginPath = path.join(pluginRoot, entry.name, "SKILL.md");
  const content = await readFile(skillPath, "utf8");
  const pluginContent = await readFile(pluginPath, "utf8");
  if (content !== pluginContent)
    throw new Error(`Plugin skill differs from portable skill: ${entry.name}`);
  if (content.includes("[TODO:")) throw new Error(`Unfinished placeholder in ${skillPath}`);
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (frontmatter === null) throw new Error(`Missing YAML frontmatter: ${skillPath}`);
  const name = frontmatter[1]?.match(/^name:\s*([^\r\n]+)$/m)?.[1]?.trim();
  const description = frontmatter[1]?.match(/^description:\s*([^\r\n]+)$/m)?.[1]?.trim();
  if (name !== entry.name) throw new Error(`Skill name must match folder: ${entry.name}`);
  if (name === undefined || name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`Invalid skill name: ${String(name)}`);
  }
  if (description === undefined || description.length > 1024 || /[<>]/.test(description)) {
    throw new Error(`Invalid skill description: ${entry.name}`);
  }
  if (content.split(/\r?\n/).length > 500)
    throw new Error(`Skill exceeds 500 lines: ${entry.name}`);
  for (const match of content.matchAll(/\]\((references\/[^)]+)\)/g)) {
    const reference = match[1];
    if (reference === undefined) continue;
    const referencePath = path.join(root, entry.name, reference);
    if (!(await stat(referencePath)).isFile())
      throw new Error(`Missing skill reference: ${referencePath}`);
    const pluginReferencePath = path.join(pluginRoot, entry.name, reference);
    const referenceContent = await readFile(referencePath, "utf8");
    const pluginReferenceContent = await readFile(pluginReferencePath, "utf8");
    if (referenceContent !== pluginReferenceContent) {
      throw new Error(
        `Plugin skill reference differs from portable skill: ${entry.name}/${reference}`,
      );
    }
  }
}

process.stdout.write(`Validated ${entries.length} portable skills and plugin copies.\n`);
