import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { scanRepository } from "../dist/core/engine.js";
import { evaluateCorpus } from "../dist/validation/evaluator.js";
import { corpusLabelsSchema, corpusManifestSchema } from "../dist/validation/model.js";

const [manifestArgument, repositoryArgument, outputArgument] = process.argv.slice(2);
if (manifestArgument === undefined || repositoryArgument === undefined) {
  throw new Error("Usage: validate-external.mjs <manifest.json> <pinned-corpus-directory>");
}
const manifestPath = path.resolve(manifestArgument);
const repositoryPath = path.resolve(repositoryArgument);
const manifest = corpusManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
const nullDevice = process.platform === "win32" ? "NUL" : "/dev/null";
const git = spawnSync(
  "git",
  [
    "-C",
    repositoryPath,
    "-c",
    `safe.directory=${repositoryPath.replaceAll("\\", "/")}`,
    "-c",
    `core.hooksPath=${nullDevice}`,
    "-c",
    "credential.helper=",
    "--no-pager",
    "rev-parse",
    "HEAD",
  ],
  {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 10_000,
    maxBuffer: 64_000,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      PATHEXT: process.env.PATHEXT,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: nullDevice,
      GIT_TERMINAL_PROMPT: "0",
    },
  },
);
if (git.error !== undefined || git.status !== 0)
  throw new Error("Pinned corpus is not readable by Git.");
if (git.stdout.trim() !== manifest.immutableRevision)
  throw new Error("Corpus revision does not match its immutable manifest.");

// The scanner sees only repository source. Expected labels are deliberately loaded afterward.
const scan = await scanRepository({ path: repositoryPath, advisories: "offline" });
const labelsPath = path.resolve(path.dirname(manifestPath), "..", "..", manifest.labelsPath);
const labels = corpusLabelsSchema.parse(JSON.parse(await readFile(labelsPath, "utf8")));
const result = evaluateCorpus(manifest, labels, scan.findings);
if (outputArgument !== undefined) {
  const outputPath = path.resolve(outputArgument);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
