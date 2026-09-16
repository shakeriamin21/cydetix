import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const beta3Commit = "c937ae1ddbf329bc62fb0376f04bf2123f438f4e";
const beta3TagObject = "29203b647094604184bdd84386a1e7f23809ac28";
const readinessEvidenceHead = "0da72c1babc01a5d8ffb3708caba29bdd0de0f06";
const auditedCandidateVersion = "0.6.0-beta.4";
const candidateVersion = "1.0.0";
const expectedExports = {
  "./schemas/scan-report.schema.json": "./schemas/scan-report.schema.json",
  "./schemas/finding.schema.json": "./schemas/finding.schema.json",
  "./schemas/rule.schema.json": "./schemas/rule.schema.json",
  "./schemas/remediation-report.schema.json": "./schemas/remediation-report.schema.json",
  "./schemas/cyclonedx-1.7.schema.json": "./schemas/cyclonedx-1.7.schema.json",
  "./package.json": "./package.json",
};

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function git(arguments_) {
  const result = spawnSync("git", ["-c", "core.hooksPath=", ...arguments_], {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 5_000_000,
  });
  if (result.error !== undefined || result.status !== 0)
    throw new Error(`V1 readiness Git check failed: ${arguments_[0] ?? "unknown"}.`);
  return result.stdout.trim();
}

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

const [pkg, policy, readiness, limitations, governance, stress, dependabotReview, allowances] =
  await Promise.all([
    json("package.json"),
    json("validation/v1-readiness/contract-policy.json"),
    json("validation/v1-readiness/readiness.json"),
    json("validation/v1-readiness/limitations.json"),
    json("validation/v1-readiness/governance.json"),
    json("validation/v1-readiness/docker-cleanup-stress.json"),
    json("validation/v1-readiness/dependabot-author-review.json"),
    json("validation/history-author-allowances.json"),
  ]);

invariant(pkg.version === candidateVersion, "V1 stabilization candidate version changed.");
invariant(
  readiness.candidate.version === auditedCandidateVersion &&
    readiness.candidate.state === "UNTAGGED_DEVELOPMENT_CANDIDATE" &&
    readiness.candidate.releaseAuthority === false,
  "The audited stabilization-candidate identity or authority changed.",
);
invariant(
  JSON.stringify(pkg.exports) === JSON.stringify(expectedExports),
  "The reviewed package export boundary changed.",
);
invariant(
  policy.programmaticApi === "NONE" && policy.deepImports === "INTERNAL_AND_BLOCKED",
  "The CLI-only programmatic package boundary is not explicit.",
);
invariant(
  JSON.stringify(policy.classes) === JSON.stringify(["STABLE", "EXPERIMENTAL", "INTERNAL"]),
  "Contract stability classes changed.",
);
invariant(
  JSON.stringify(policy.stableProofStates) ===
    JSON.stringify(["PROVEN_SECURE", "PROVEN_INSECURE", "UNKNOWN", "NOT_APPLICABLE"]),
  "Proof-state semantics changed.",
);
invariant(
  JSON.stringify(policy.stableRemediationClasses) ===
    JSON.stringify(["SAFE", "REVIEW_REQUIRED", "ARCHITECTURAL"]),
  "Remediation authority classes changed.",
);
invariant(
  JSON.stringify(policy.stableMcpTools) ===
    JSON.stringify(["cydetix_scan", "cydetix_fix", "cydetix_explain"]),
  "MCP public surface changed.",
);
invariant(
  JSON.stringify(policy.stableExports) === JSON.stringify(Object.keys(expectedExports)),
  "Machine-readable contract policy and package exports differ.",
);
const requiredSurfaceIds = [
  "cli-core",
  "cli-integration-diagnostics",
  "cli-exit-codes",
  "machine-output-stable-schemas",
  "human-diagnostics",
  "json-internal-analysis-evidence",
  "sarif-2.1.0",
  "sarif-cydetix-properties",
  "rule-ids",
  "rule-versions",
  "proof-states",
  "remediation-classes",
  "mcp-three-tool-surface",
  "agent-skills-adapters",
  "cydetix-config",
  "generated-host-config",
  "npm-cli-bin",
  "programmatic-js-ts-api",
  "exported-json-subpaths",
  "public-typescript-imports",
  "release-governance-implementation",
];
invariant(
  requiredSurfaceIds.every((id) => policy.surfaces.some((surface) => surface.id === id)),
  "The contract matrix does not classify every required surface.",
);

invariant(readiness.verdict === "V1_READY_WITH_LIMITATIONS", "V1 hard blockers remain open.");
invariant(
  Array.isArray(readiness.blockers) &&
    readiness.blockers.length === 4 &&
    readiness.blockers.every((blocker) => blocker.state === "CLOSED"),
  "Every historical V1 blocker must be preserved and explicitly closed.",
);
invariant(
  limitations.items
    .filter((item) => item.classification === "V1_BLOCKER")
    .every((item) => item.resolution?.state === "CLOSED"),
  "A limitations-inventory V1 blocker is unresolved.",
);
invariant(
  governance.checks.every((check) => check.state === "PASS"),
  "Every required stabilization governance check must pass before the readiness verdict.",
);
invariant(
  stress.historicalFailure?.suiteResult === "12/13" &&
    stress.historicalFailure?.leakedContainerState === "Created",
  "The historical Docker lifecycle failure was erased.",
);
invariant(
  stress.state === "PASSED" &&
    stress.totalRuns >= 50 &&
    stress.passed === stress.totalRuns &&
    stress.cleanupFailures === 0 &&
    stress.leakedContainerCount === 0,
  "Docker cleanup stress evidence is insufficient.",
);
invariant(
  dependabotReview.entries.length === 3 &&
    dependabotReview.entries.every(
      (entry) => entry.decision === "ALLOW_EXACT_TUPLE" && !entry.ancestralToBeta3OrMain,
    ) &&
    dependabotReview.futureUnknownBotIdentities === "DENY_FAIL_CLOSED",
  "Dependabot author review is incomplete or overly broad.",
);
for (const reviewed of dependabotReview.entries) {
  const allowance = allowances.entries.find((entry) => entry.commit === reviewed.commit);
  invariant(
    allowance?.observedRef === reviewed.ref &&
      allowance.authorName === reviewed.authorName &&
      allowance.committerName === reviewed.committerName,
    `Exact author-policy allowance is missing for ${reviewed.commit}.`,
  );
}

const head = git(["rev-parse", "HEAD"]);
const auditedSourceSha = readiness.auditedSourceSha;
invariant(/^[a-f0-9]{40}$/u.test(auditedSourceSha), "Audited source SHA is not exact.");
invariant(
  git(["rev-parse", readinessEvidenceHead]) === readinessEvidenceHead &&
    git(["rev-parse", `${readinessEvidenceHead}^`]) === auditedSourceSha,
  "The final readiness-evidence commit is not the exact direct child of the audited source.",
);
if (head !== readinessEvidenceHead)
  invariant(
    git(["rev-parse", `${head}^`]) === readinessEvidenceHead &&
      git(["rev-list", "--count", `${readinessEvidenceHead}..${head}`]) === "1",
    "The V1 candidate must be exactly one commit above the final readiness-evidence commit.",
  );
invariant(stress.sourceCommit === auditedSourceSha, "Docker stress evidence targets another SHA.");
invariant(
  governance.auditedSourceSha === auditedSourceSha,
  "Governance evidence targets another SHA.",
);
const releasePreparationPaths = new Set([
  ".github/workflows/release.yml",
  "CHANGELOG.md",
  "README.md",
  "SECURITY.md",
  "dist/core/brand.d.ts",
  "dist/core/brand.js",
  "dist/core/brand.js.map",
  "dist/validation/release-channel.d.ts",
  "dist/validation/release-channel.d.ts.map",
  "dist/validation/release-channel.js",
  "dist/validation/release-channel.js.map",
  "docs/LIMITATIONS.md",
  "docs/V1_COMPATIBILITY.md",
  "docs/integrations/agents.md",
  "docs/integrations/releases.md",
  "docs/releases/v1.0.0.md",
  "package-lock.json",
  "package.json",
  "plugins/cydetix/.codex-plugin/plugin.json",
  "release/publication-config.json",
  "scripts/resolve-release-channel.mjs",
  "scripts/validate-development.mjs",
  "scripts/validate-publication-config.mjs",
  "scripts/validate-v1-readiness.mjs",
  "scripts/validate-workflow-security.mjs",
  "src/core/brand.ts",
  "src/validation/release-channel.ts",
  "tests/cli/smoke.test.ts",
  "tests/cli/trust.test.ts",
  "tests/integrations/compatibility.test.ts",
  "tests/integrations/setup.test.ts",
  "tests/security/workflow-security.test.ts",
  "tests/validation/development.test.ts",
  "tests/validation/publication-config.test.ts",
  "tests/validation/release-channel.test.ts",
]);
const candidateChanges = [
  ...git(["diff", "--name-only", auditedSourceSha]).split("\n").filter(Boolean),
  ...git(["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean),
].filter((file, index, files) => files.indexOf(file) === index);
const outOfScopeChanges = candidateChanges.filter(
  (file) =>
    file !== "docs/security/V1_READINESS.md" &&
    !file.startsWith("validation/v1-readiness/") &&
    !releasePreparationPaths.has(file),
);
invariant(candidateChanges.length > 0, "The V1 candidate has no audited-source delta.");
invariant(
  outOfScopeChanges.length === 0,
  `Changes after the audited source SHA exceed release preparation: ${outOfScopeChanges.join(", ")}.`,
);
invariant(
  git(["rev-parse", "refs/tags/v0.6.0-beta.3"]) === beta3TagObject &&
    git(["rev-parse", "refs/tags/v0.6.0-beta.3^{}"]) === beta3Commit,
  "The immutable Beta.3 identity changed.",
);
invariant(git(["tag", "--list", "v0.6.0-beta.4"]) === "", "A Beta.4 tag exists.");
invariant(git(["tag", "--list", "v1*"]) === "", "A V1 tag exists.");
invariant(
  git(["diff", "--name-only", beta3Commit, head, "--", "validation/releases/v0.6.0-beta.3"]) === "",
  "The immutable Beta.3 release-evidence directory changed during V1 stabilization.",
);

const [readme, compatibility, readinessDocument] = await Promise.all([
  readFile("README.md", "utf8"),
  readFile("docs/V1_COMPATIBILITY.md", "utf8"),
  readFile("docs/security/V1_READINESS.md", "utf8"),
]);
invariant(
  readme.includes("npm exec --yes --package=cydetix@0.6.0-beta.3 -- cydetix") &&
    readme.includes("unpublished `1.0.0` V1 release") &&
    !readme.includes("current source is the unpublished `0.6.0-beta.3`"),
  "Primary installation or release-status documentation is stale.",
);
invariant(
  compatibility.includes("`STABLE`") &&
    compatibility.includes("`EXPERIMENTAL`") &&
    compatibility.includes("`INTERNAL`") &&
    readinessDocument.includes("V1_READY_WITH_LIMITATIONS"),
  "Human-readable V1 compatibility/readiness evidence is incomplete.",
);

process.stdout.write(
  `V1 readiness evidence validated for ${auditedSourceSha}: four historical blockers closed, 50+ Docker stress runs leak-free, and verdict V1_READY_WITH_LIMITATIONS.\n`,
);
