import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { PRODUCT } from "../dist/core/brand.js";
import { releaseValidationReportSchema } from "../dist/validation/release.js";

// An explicit development-only gate. Strict release validators and release workflow are unchanged.
if (process.env.CYDETIX_EXPECTED_TAG || process.env.GITHUB_REF_TYPE === "tag")
  throw new Error("Development validation cannot validate a release tag. Use npm run verify.");
const baseline = "4e13b96cc3539e1b623a4c5a12f10a0954776253";
const tagObject = "e692f1e23d58157a209f511adb6180d3f489a80c";
const version = "0.6.0-alpha.12";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const plugin = JSON.parse(await readFile("plugins/cydetix/.codex-plugin/plugin.json", "utf8"));
for (const [name, value] of Object.entries({
  package: pkg.version,
  lock: lock.version,
  lockRoot: lock.packages[""].version,
  runtime: PRODUCT.version,
  plugin: plugin.version,
}))
  if (value !== version) throw new Error(`Development version mismatch: ${name} has ${value}.`);
if (pkg.engines.node !== lock.packages[""].engines.node)
  throw new Error("Node engine range mismatch.");
for (const file of ["README.md", "CHANGELOG.md", "src/core/brand.ts"])
  if (!(await readFile(file, "utf8")).includes(version))
    throw new Error(`Missing development version: ${file}`);
function git(args) {
  const result = spawnSync("git", ["-c", "core.hooksPath=", ...args], {
    shell: false,
    windowsHide: true,
    timeout: 20_000,
    maxBuffer: 15_000_000,
  });
  if (result.error || result.status !== 0)
    throw new Error(`Historical evidence check failed: git ${args[0]}`);
  return result.stdout;
}
if (
  git(["rev-parse", "v0.6.0-alpha.11"]).toString().trim() !== tagObject ||
  git(["rev-parse", "v0.6.0-alpha.11^{}"]).toString().trim() !== baseline
)
  throw new Error("Immutable alpha.11 identity changed.");
const historicalPaths = [
  "docs/releases",
  "validation/validation-report.json",
  "validation/gitleaks-reviewed-findings.json",
  "docs/security/ALPHA11_BATCH2_VALIDATION.md",
  "docs/security/ALPHA11_BATCH2_EXTERNAL_CORPUS_VALIDATION.md",
  "docs/security/ALPHA11_BATCH2_EXTERNAL_CORPUS_MANIFEST.json",
];
const files = git(["ls-tree", "-r", "--name-only", baseline, "--", ...historicalPaths])
  .toString()
  .trim()
  .split("\n");
for (const file of files) {
  if (!(await readFile(file)).equals(git(["show", `${baseline}:${file}`])))
    throw new Error(`Historical release evidence changed: ${file}`);
}
const historical = releaseValidationReportSchema.parse(
  JSON.parse(await readFile("validation/validation-report.json", "utf8")),
);
if (historical.product.version !== "0.6.0-alpha.11")
  throw new Error("Historical evidence identity mismatch.");
process.stdout.write(
  `Development ${version} is consistent; ${files.length} historical evidence files and immutable alpha.11 identity preserved. Release readiness is not asserted.\n`,
);
