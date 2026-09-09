import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { scanRepository } from "../dist/core/engine.js";
import { generateCycloneDxSbom } from "../dist/supply-chain/sbom.js";

const root = path.resolve(".");
const preview = process.argv.includes("--preview");
const destination = path.resolve(
  process.env.CYDETIX_RELEASE_DIR ?? path.join(".cydetix", preview ? "release-preview" : "release"),
);
const npmCli = process.env.npm_execpath;
if (npmCli === undefined) throw new Error("npm_execpath is required; invoke through npm run.");

function run(
  executable,
  arguments_,
  timeout = 120_000,
  extraEnvironment = {},
  acceptedStatuses = [0],
) {
  const result = spawnSync(executable, arguments_, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout,
    maxBuffer: 5_000_000,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      PATHEXT: process.env.PATHEXT,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      npm_config_cache: path.resolve(".npm-cache"),
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
      GIT_TERMINAL_PROMPT: "0",
      ...extraEnvironment,
    },
  });
  if (result.error !== undefined || !acceptedStatuses.includes(result.status)) {
    const diagnostic = String(result.stderr ?? "")
      .replaceAll(root, "<workspace>")
      .trim()
      .slice(-1_000);
    throw new Error(
      `Release artifact command failed safely: ${path.basename(executable)}; exit=${String(result.status)}; error=${String(result.error?.code ?? "none")}; stderr=${diagnostic || "none"}.`,
    );
  }
  return result.stdout;
}

async function digest(file) {
  const content = await readFile(file);
  return {
    artifact: path.basename(file),
    sha256: createHash("sha256").update(content).digest("hex"),
    bytes: content.length,
  };
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const publication = JSON.parse(
  await readFile(path.join(root, "release", "publication-config.json"), "utf8"),
);
const worktreeStatus = run("git", [
  "-c",
  `safe.directory=${root.replaceAll("\\", "/")}`,
  "status",
  "--porcelain",
  "--untracked-files=all",
]).trim();
if (worktreeStatus !== "" && !preview)
  throw new Error("Release artifacts require a clean committed worktree and index.");
const sourceState = worktreeStatus === "" ? "COMMITTED_CLEAN" : "UNCOMMITTED_PREVIEW";
const publicRepositoryAudit = JSON.parse(
  run(process.execPath, [path.join(root, "scripts", "audit-public-repository.mjs")]),
);
const currentSourcePaths = run("git", [
  "-c",
  `safe.directory=${root.replaceAll("\\", "/")}`,
  "ls-files",
  "-z",
  "--cached",
  "--others",
  "--exclude-standard",
])
  .split("\0")
  .filter(Boolean)
  .sort();
const sourceTreeHash = createHash("sha256");
for (const relative of currentSourcePaths) {
  const content = await readFile(path.join(root, relative)).catch(() => undefined);
  if (content === undefined) continue;
  sourceTreeHash.update(relative.replaceAll("\\", "/"));
  sourceTreeHash.update("\0");
  sourceTreeHash.update(String(content.length));
  sourceTreeHash.update("\0");
  sourceTreeHash.update(content);
}
const sourceTreeSha256 = sourceTreeHash.digest("hex");
const historyAudit = JSON.parse(
  run(
    process.execPath,
    [path.join(root, "scripts", "audit-git-history.mjs"), "--ref", "HEAD"],
    120_000,
    {},
    preview ? [0, 1] : [0],
  ),
);
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
const packed = JSON.parse(
  run(process.execPath, [
    npmCli,
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    destination,
  ]),
)[0];
if (packed === undefined) throw new Error("npm pack did not return package metadata.");
const tarball = path.join(destination, packed.filename);

const report = await scanRepository({
  path: root,
  advisories: "offline",
  now: new Date("2026-09-04T00:00:00.000Z"),
});
const inventory = report.securityAnalysis.supplyChainAnalysis?.inventory;
if (inventory === undefined) throw new Error("Cydetix dependency inventory is unavailable.");
const sbom = generateCycloneDxSbom(inventory);
const sbomPath = path.join(destination, "cydetix.cdx.json");
await writeFile(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`, "utf8");

const pluginManifest = JSON.parse(
  await readFile(path.join(root, "plugins", "cydetix", ".codex-plugin", "plugin.json"), "utf8"),
);
const pluginName = `${pluginManifest.name}-codex-plugin-${packageJson.version}.tar.gz`;
const pluginPath = path.join(destination, pluginName);
run("tar", ["-czf", pluginPath, "-C", path.join(root, "plugins"), "cydetix"]);
run(process.execPath, [path.join(root, "scripts", "validate-package.mjs")], 120_000, {
  npm_execpath: npmCli,
});
run(process.execPath, [path.join(root, "scripts", "validate-packed-install.mjs")], 300_000, {
  npm_execpath: npmCli,
  CYDETIX_PACKAGE_TARBALL: tarball,
});
run(process.execPath, [path.join(root, "scripts", "validate-packed-plugin.mjs")], 120_000, {
  CYDETIX_RELEASE_DIR: destination,
});

const artifacts = await Promise.all([digest(tarball), digest(sbomPath), digest(pluginPath)]);
const lockfile = await digest(path.join(root, "package-lock.json"));
const catalogue = await digest(path.join(root, "rules", "catalogue.json"));
const schemaNames = (await readdir(path.join(root, "schemas")))
  .filter((name) => name.endsWith(".json"))
  .sort();
const schemas = await Promise.all(
  schemaNames.map((name) => digest(path.join(root, "schemas", name))),
);
const sourceCommit = run("git", [
  "-c",
  `safe.directory=${root.replaceAll("\\", "/")}`,
  "rev-parse",
  "HEAD",
]).trim();
const nodeVersion = process.version;
const npmVersion = run(process.execPath, [npmCli, "--version"]).trim();
const gitleaks = await readFile(
  path.join(root, ".cydetix", "evidence", "gitleaks-review.json"),
  "utf8",
)
  .then(JSON.parse)
  .catch(() => ({ state: "NOT_CHECKED" }));
const osv = await readFile(path.join(root, ".cydetix", "evidence", "osv-online.json"), "utf8")
  .then(JSON.parse)
  .catch(() => ({ state: "NOT_CHECKED" }));
const phase6bValidation = JSON.parse(
  await readFile(path.join(root, "validation", "validation-report.json"), "utf8"),
);
const declaredState = (name) => process.env[name] ?? "NOT_CHECKED";
const checks = {
  historicalTests: declaredState("CYDETIX_HISTORICAL_TESTS_STATE"),
  hostedCi: process.env.CYDETIX_HOSTED_CI_STATE ?? "NOT_RUN",
  sandboxRegression: declaredState("CYDETIX_SANDBOX_REGRESSION_STATE"),
  selfScan: declaredState("CYDETIX_SELF_SCAN_STATE"),
  supplyChain: declaredState("CYDETIX_SUPPLY_CHAIN_STATE"),
  npmAudit: process.env.CYDETIX_NPM_AUDIT_STATE ?? "NOT_CHECKED",
  osv: osv.state,
  publicRepository: publicRepositoryAudit.state,
  gitHistoryPrivacy: historyAudit.state,
  independentSecretScan: gitleaks.state,
  packageAllowlist: "PASS",
  packageInstall: "PASS",
  skills: declaredState("CYDETIX_SKILLS_STATE"),
  plugin: "PASS",
  schemas: declaredState("CYDETIX_SCHEMAS_STATE"),
  sarif: declaredState("CYDETIX_SARIF_STATE"),
  cyclonedx: declaredState("CYDETIX_CYCLONEDX_STATE"),
  licenseAudit: declaredState("CYDETIX_LICENSE_AUDIT_STATE"),
  workflowSecurity: declaredState("CYDETIX_WORKFLOW_SECURITY_STATE"),
  openssfScorecard: process.env.CYDETIX_OPENSSF_STATE ?? "NOT_CHECKED",
};
const releaseCandidateState =
  publication.decision === "APPROVED" && Object.values(checks).every((state) => state === "PASS")
    ? "RELEASE_CANDIDATE"
    : "NOT_READY_FOR_PUBLICATION";
const phase7Validation = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  state: releaseCandidateState,
  version: packageJson.version,
  sourceCommit,
  sourceState,
  checks,
  phase6bEvidence: {
    verdict: phase6bValidation.verdict,
    evidenceOrigin: phase6bValidation.product.evidenceOrigin,
    ...(phase6bValidation.product.publicSourceCommit === undefined
      ? {}
      : { publicSourceCommit: phase6bValidation.product.publicSourceCommit }),
    sandboxState: phase6bValidation.sandbox.state,
    tests: phase6bValidation.tests,
    environment: phase6bValidation.environment,
  },
};
const validationName = `cydetix-release-validation-${packageJson.version}.json`;
const validationPath = path.join(destination, validationName);
await writeFile(validationPath, `${JSON.stringify(phase7Validation, null, 2)}\n`, "utf8");
artifacts.push(await digest(validationPath));
const releaseInputs = {
  schemaVersion: "1.0.0",
  sourceCommit,
  sourceState,
  sourceTreeSha256,
  productVersion: packageJson.version,
  nodeVersion,
  npmVersion,
  lockfile,
  catalogue,
  schemas,
  package: {
    entries: packed.entryCount,
    packedBytes: packed.size,
    unpackedBytes: packed.unpackedSize,
    sizeGateBytes: 400_000,
  },
  artifacts,
  reproducibilityClaim: "REPRODUCIBLE_INPUT_MANIFEST_ONLY",
};
const manifestPath = path.join(destination, "release-inputs.json");
await writeFile(manifestPath, `${JSON.stringify(releaseInputs, null, 2)}\n`, "utf8");

const publicReleaseManifest = {
  schemaVersion: "1.0.0",
  state: releaseCandidateState,
  version: packageJson.version,
  sourceCommit,
  sourceState,
  sourceTreeSha256,
  tagCandidate: `v${packageJson.version}`,
  identity: {
    decision: publication.decision,
    productName: publication.productName,
    npmPackageName: publication.npmPackageName,
    githubRepository: publication.githubRepository,
    cliCommand: publication.cliCommand,
  },
  runtime: {
    generatedWith: { node: nodeVersion, npm: npmVersion },
    supportedNode: ["22.18+ within Node 22", "24.11+ within Node 24"],
    phase6bSandboxEnvironment: phase6bValidation.environment,
  },
  artifacts,
  lockfile,
  ruleCatalogue: catalogue,
  schemas,
  validation: phase7Validation.checks,
  provenance: {
    npmPackageRegistration: publication.npmPackageRegistration,
    npmTrustedPublishing: publication.npmTrustedPublisher,
    npmDistTag: publication.npmDistTag,
    githubArtifactAttestation: "WORKFLOW_CONFIGURED_NOT_EXECUTED",
    sbomAttestation: "WORKFLOW_CONFIGURED_NOT_EXECUTED",
  },
  knownLimitations: phase6bValidation.knownLimitations,
};
const publicManifestPath = path.join(destination, "release-manifest.json");
await writeFile(publicManifestPath, `${JSON.stringify(publicReleaseManifest, null, 2)}\n`, "utf8");

const checksumEntries = await Promise.all([
  ...artifacts.map((artifact) => digest(path.join(destination, artifact.artifact))),
  digest(manifestPath),
  digest(publicManifestPath),
]);
await writeFile(
  path.join(destination, "SHA256SUMS"),
  `${checksumEntries.map((entry) => `${entry.sha256}  ${entry.artifact}`).join("\n")}\n`,
  "utf8",
);
if ((await stat(tarball)).size !== packed.size) throw new Error("Tarball size evidence mismatch.");
process.stdout.write(`${JSON.stringify(publicReleaseManifest, null, 2)}\n`);
