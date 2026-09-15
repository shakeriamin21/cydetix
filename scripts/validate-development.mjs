import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { PRODUCT } from "../dist/core/brand.js";
import {
  assessReleaseTagIntegrity,
  releaseHistorySchema,
  verifyHistoricalEvidenceSnapshot,
} from "../dist/validation/release-evidence.js";

// An explicit development-only gate. Strict release validators and release workflow are unchanged.
if (process.env.CYDETIX_EXPECTED_TAG || process.env.GITHUB_REF_TYPE === "tag")
  throw new Error("Development validation cannot validate a release tag. Use npm run verify.");
const baseline = "4e13b96cc3539e1b623a4c5a12f10a0954776253";
const tagObject = "e692f1e23d58157a209f511adb6180d3f489a80c";
const version = "0.6.0-beta.3";
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
const history = releaseHistorySchema.parse(
  JSON.parse(await readFile("validation/releases/release-history.json", "utf8")),
);
for (const required of [
  {
    tag: "v0.6.0-alpha.11",
    object: tagObject,
    target: baseline,
  },
  {
    tag: "v0.6.0-alpha.12",
    object: "c03f2a1e72af312266f68d66ac4183e0c00511bd",
    target: "5bf295f53f4ca912a79715fd1ea455a31b72a585",
  },
  {
    tag: "v0.6.0-beta.1",
    object: "4aecf7055d2184d18e1dc5da63dd3a6e65e0259d",
    target: "9ecc68f54127e5951d7c2a829cdd719b35779809",
  },
  {
    tag: "v0.6.0-beta.2",
    object: "a76d297b9749aff247ce980310441d1b058f1644",
    target: "e4dbda8b15620e99827b056b92b51ce68a4c60e8",
  },
]) {
  const recorded = history.tags.find((entry) => entry.tag === required.tag);
  if (recorded?.object !== required.object || recorded.target !== required.target)
    throw new Error(`Immutable historical identity changed: ${required.tag}`);
}
const alpha11Snapshot = history.evidenceSnapshots.find(
  (snapshot) => snapshot.version === "0.6.0-alpha.11",
);
if (
  alpha11Snapshot?.tag !== "v0.6.0-alpha.11" ||
  alpha11Snapshot.sourcePath !== "validation/validation-report.json" ||
  alpha11Snapshot.snapshotPath !== "validation/releases/v0.6.0-alpha.11/validation-report.json" ||
  alpha11Snapshot.sha256 !== "35ecd64fbd9c9d0a4bdff306afd058ee3e0c32cdb19dcb3dd3c051022a51b4bf"
)
  throw new Error("Immutable alpha.11 evidence snapshot contract changed.");
const alpha12Failure = history.failedReleaseAttempts.find(
  (attempt) => attempt.tag === "v0.6.0-alpha.12",
);
if (
  alpha12Failure?.releaseRun !== 34821381636 ||
  alpha12Failure.state !== "FAILED_BEFORE_PUBLICATION" ||
  alpha12Failure.npmPublished !== false ||
  alpha12Failure.publicGitHubReleaseCreated !== false
)
  throw new Error("Immutable alpha.12 failed-release record changed.");
const beta1Failure = history.failedReleaseAttempts.find(
  (attempt) => attempt.tag === "v0.6.0-beta.1",
);
if (
  beta1Failure?.releaseRun !== 34930694658 ||
  beta1Failure.state !== "FAILED_BEFORE_PUBLICATION" ||
  beta1Failure.npmPublished !== false ||
  beta1Failure.publicGitHubReleaseCreated !== false
)
  throw new Error("Immutable beta.1 failed-release record changed.");
const beta2Failure = history.failedReleaseAttempts.find(
  (attempt) => attempt.tag === "v0.6.0-beta.2",
);
if (
  beta2Failure?.releaseRun !== 34937375125 ||
  beta2Failure.state !== "FAILED_BEFORE_PUBLICATION" ||
  beta2Failure.npmPublished !== false ||
  beta2Failure.publicGitHubReleaseCreated !== false
)
  throw new Error("Immutable beta.2 failed-release record changed.");
const observedTags = git(["tag", "--list", "v*"])
  .toString()
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((tag) => ({
    tag,
    type: git(["cat-file", "-t", `refs/tags/${tag}`])
      .toString()
      .trim(),
    object: git(["rev-parse", `refs/tags/${tag}`])
      .toString()
      .trim(),
    target: git(["rev-parse", `refs/tags/${tag}^{}`])
      .toString()
      .trim(),
  }));
const tagIntegrity = assessReleaseTagIntegrity(history, observedTags, {
  currentVersion: version,
  currentHead: git(["rev-parse", "HEAD"]).toString().trim(),
});
if (tagIntegrity.state !== "PASS")
  throw new Error(`Historical release tag integrity failed: ${tagIntegrity.issues.join(" ")}`);
const historicalPaths = [
  "docs/releases",
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
for (const snapshot of history.evidenceSnapshots) {
  const tagged = history.tags.find((entry) => entry.tag === snapshot.tag);
  if (tagged === undefined) throw new Error(`Historical snapshot tag missing: ${snapshot.tag}`);
  verifyHistoricalEvidenceSnapshot(
    snapshot,
    await readFile(snapshot.snapshotPath),
    git(["show", `${tagged.target}:${snapshot.sourcePath}`]),
  );
}
process.stdout.write(
  `Development ${version} is consistent; ${files.length + history.evidenceSnapshots.length} historical evidence files and immutable release identities preserved. Release readiness is not asserted.\n`,
);
