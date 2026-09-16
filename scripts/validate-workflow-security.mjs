import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";

const workflowDirectory = path.join(".github", "workflows");
const workflowNames = (await readdir(workflowDirectory))
  .filter((name) => /\.ya?ml$/u.test(name))
  .sort();
const issues = [];

for (const name of workflowNames) {
  const relative = path.join(workflowDirectory, name).replaceAll("\\", "/");
  const source = await readFile(relative, "utf8");
  let workflow;
  try {
    workflow = parse(source);
  } catch {
    issues.push(`${relative}: invalid YAML`);
    continue;
  }
  if (workflow?.on?.pull_request_target !== undefined)
    issues.push(`${relative}: pull_request_target is forbidden`);
  if (/secrets\.NPM_TOKEN|npm[_-]?token/iu.test(source))
    issues.push(`${relative}: long-lived npm token reference is forbidden`);
  for (const match of source.matchAll(/^\s*uses:\s*([^\s#]+).*$/gmu)) {
    const reference = match[1];
    if (reference.startsWith("./")) continue;
    if (!/@[a-f0-9]{40}$/u.test(reference))
      issues.push(`${relative}: action is not full-SHA pinned: ${reference}`);
  }
}

const release = parse(await readFile(path.join(workflowDirectory, "release.yml"), "utf8"));
if (release?.on?.push?.tags?.[0] !== "v*") issues.push("release.yml: tag trigger is missing");
if (release?.on?.pull_request !== undefined)
  issues.push("release.yml: pull requests must not trigger releases");
const publish = release?.jobs?.publish;
const verifyRelease = release?.jobs?.["verify-release"];
if (publish?.name !== "Publish approved release")
  issues.push("release.yml: publish job wording must cover prerelease and stable releases");
const releaseCheckoutStep = verifyRelease?.steps?.find(
  (step) => step?.name === "Checkout tagged source without persisted credentials",
);
if (
  releaseCheckoutStep?.with?.["fetch-depth"] !== 0 ||
  releaseCheckoutStep?.with?.["persist-credentials"] !== false
)
  issues.push(
    "release.yml: release checkout must fetch complete history without persisted credentials",
  );
if (publish?.environment !== "release")
  issues.push("release.yml: publish job lacks the protected release environment");
for (const [permission, expected] of [
  ["contents", "write"],
  ["id-token", "write"],
  ["attestations", "write"],
]) {
  if (publish?.permissions?.[permission] !== expected)
    issues.push(`release.yml: publish permission ${permission} must be ${expected}`);
}
if (release?.jobs?.["verify-release"]?.permissions?.["id-token"] !== undefined)
  issues.push("release.yml: verification job must not receive OIDC identity");
for (const [name, workflow] of [
  ["Require successful exact-commit hosted CI", "ci.yml"],
  ["Require successful exact-commit CodeQL run", "codeql.yml"],
  ["Require successful exact-commit OpenSSF run", "scorecard.yml"],
]) {
  const step = verifyRelease?.steps?.find((candidate) => candidate?.name === name);
  if (
    step?.env?.GITHUB_TOKEN !== "${{ github.token }}" ||
    step?.run !== `npm run validate:hosted-workflow -- ${workflow}`
  )
    issues.push(`release.yml: ${workflow} exact-commit success gate is missing or weakened`);
}
const historyAuditStep = release?.jobs?.["verify-release"]?.steps?.find(
  (step) => step?.name === "Reject unsanitized reachable history",
);
if (
  historyAuditStep?.env?.CYDETIX_EXPECTED_TAG !== "${{ github.ref_name }}" ||
  historyAuditStep?.run !==
    'npm run audit:history -- --enforce --ref "refs/tags/${CYDETIX_EXPECTED_TAG}"'
)
  issues.push("release.yml: Git-history privacy audit is not scoped to the validated release tag");
const gitleaksStep = release?.jobs?.["verify-release"]?.steps?.find(
  (step) => step?.name === "Independently scan complete history",
);
const expectedGitleaksScript = [
  "mkdir -p .cydetix/evidence",
  "if [ -e .gitleaksignore ] || [ -L .gitleaksignore ]; then",
  '  echo "Repository-controlled .gitleaksignore is forbidden in the release scan" >&2',
  "  exit 1",
  "fi",
  "docker run --rm --network none --read-only --cap-drop ALL \\",
  "  --security-opt no-new-privileges --pids-limit 128 --memory 512m --cpus 1 \\",
  '  --user "$(id -u):$(id -g)" --mount "type=bind,source=$PWD,target=/repo,readonly" \\',
  '  --mount "type=bind,source=$PWD/.cydetix/evidence,target=/evidence" \\',
  "  ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f \\",
  "  git /repo --redact=100 --report-format json --report-path /evidence/gitleaks.json \\",
  "  --config /repo/validation/gitleaks.toml \\",
  "  --gitleaks-ignore-path /dev/null --ignore-gitleaks-allow \\",
  '  --log-opts="--full-history --all --text --no-textconv --no-ext-diff" \\',
  "  --no-banner --no-color --exit-code 0 --timeout 180",
  "node scripts/validate-gitleaks-report.mjs .cydetix/evidence/gitleaks.json",
].join("\n");
if (gitleaksStep?.shell !== "bash" || gitleaksStep?.run?.trim() !== expectedGitleaksScript)
  issues.push(
    "release.yml: complete-history Gitleaks scan must be pinned, unsuppressed, sandboxed, and exactly validated",
  );
let gitleaksConfig;
try {
  gitleaksConfig = await readFile(path.join("validation", "gitleaks.toml"), "utf8");
} catch {
  gitleaksConfig = undefined;
}
if (
  gitleaksConfig?.replaceAll("\r\n", "\n") !==
  'title = "Cydetix release history gate"\n\n[extend]\nuseDefault = true\n'
)
  issues.push("validation/gitleaks.toml: config must extend the built-in rules without allowlists");
const npmPublishStep = publish?.steps?.find(
  (step) => step?.name === "Publish approved package through npm OIDC",
);
const expectedNpmPublishScript = `shopt -s nullglob
tarballs=(release-bundle/*.tgz)
if [ "\${#tarballs[@]}" -ne 1 ]; then
  echo "Expected exactly one npm tarball, found \${#tarballs[@]}" >&2
  exit 1
fi
npm_dist_tag="$(node scripts/resolve-release-channel.mjs --npm-dist-tag)"
npm publish "./\${tarballs[0]}" --access public --tag "$npm_dist_tag" --ignore-scripts`;
if (npmPublishStep?.shell !== "bash" || npmPublishStep?.run?.trim() !== expectedNpmPublishScript)
  issues.push(
    "release.yml: npm publish must require one verified local tarball and the deterministic version-derived dist-tag",
  );
const githubDraftStep = publish?.steps?.find(
  (step) => step?.name === "Create a non-public draft GitHub release",
);
const expectedGithubDraftScript = `github_prerelease="$(node scripts/resolve-release-channel.mjs --github-prerelease)"
prerelease_args=()
if [ "$github_prerelease" = "true" ]; then
  prerelease_args+=(--prerelease)
elif [ "$github_prerelease" != "false" ]; then
  echo "Unsupported GitHub prerelease state: $github_prerelease" >&2
  exit 1
fi
title="$(node -p "JSON.parse(require('fs').readFileSync('release/publication-config.json')).productName + ' v' + require('./package.json').version")"
gh release create "$GITHUB_REF_NAME" release-bundle/* --verify-tag --draft "\${prerelease_args[@]}" \\
  --title "$title" --notes-file "docs/releases/$GITHUB_REF_NAME.md"`;
if (githubDraftStep?.shell !== "bash" || githubDraftStep?.run?.trim() !== expectedGithubDraftScript)
  issues.push(
    "release.yml: draft GitHub release must derive prerelease state from the package version",
  );
const githubPublishStep = publish?.steps?.find(
  (step) => step?.name === "Publish the prepared GitHub release",
);
const expectedGithubPublishScript = `github_prerelease="$(node scripts/resolve-release-channel.mjs --github-prerelease)"
if [ "$github_prerelease" != "true" ] && [ "$github_prerelease" != "false" ]; then
  echo "Unsupported GitHub prerelease state: $github_prerelease" >&2
  exit 1
fi
gh release edit "$GITHUB_REF_NAME" --draft=false --prerelease="$github_prerelease"`;
if (
  githubPublishStep?.shell !== "bash" ||
  githubPublishStep?.run?.trim() !== expectedGithubPublishScript
)
  issues.push(
    "release.yml: final GitHub release must explicitly retain or clear prerelease state from the package version",
  );
const expectedReleaseChannelResolver = `import { readFile } from "node:fs/promises";

import {
  githubReleaseIsPrereleaseForVersion,
  npmReleaseChannelForVersion,
} from "../dist/validation/release-channel.js";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const output = process.argv[2] ?? "--npm-dist-tag";
if (process.argv.length > 3) throw new Error("Expected at most one release-semantics selector.");
if (output === "--npm-dist-tag")
  process.stdout.write(\`\${npmReleaseChannelForVersion(packageJson.version)}\\n\`);
else if (output === "--github-prerelease")
  process.stdout.write(\`\${String(githubReleaseIsPrereleaseForVersion(packageJson.version))}\\n\`);
else throw new Error(\`Unsupported release-semantics selector: \${output}.\`);
`;
let releaseChannelResolver;
try {
  releaseChannelResolver = await readFile("scripts/resolve-release-channel.mjs", "utf8");
} catch {
  releaseChannelResolver = undefined;
}
if (releaseChannelResolver?.replaceAll("\r\n", "\n") !== expectedReleaseChannelResolver)
  issues.push(
    "scripts/resolve-release-channel.mjs: deterministic package-version resolver changed",
  );

const result = {
  schemaVersion: "1.0.0",
  state: issues.length === 0 ? "PASS" : "FAIL",
  workflowsReviewed: workflowNames,
  controls: [
    "NO_PULL_REQUEST_TARGET",
    "FULL_SHA_ACTION_PINNING",
    "NO_LONG_LIVED_NPM_TOKEN",
    "TAG_ONLY_RELEASE_TRIGGER",
    "PROTECTED_RELEASE_ENVIRONMENT",
    "OIDC_ONLY_IN_PUBLISH_JOB",
    "COMPLETE_RELEASE_HISTORY_CHECKOUT",
    "RELEASE_REACHABLE_HISTORY_SCOPE",
    "PINNED_UNSUPPRESSED_COMPLETE_HISTORY_SECRET_SCAN",
    "EXACT_COMMIT_CI_CODEQL_OPENSSF_GATES",
    "EXPLICIT_SINGLE_LOCAL_NPM_TARBALL",
    "DETERMINISTIC_VERSION_DERIVED_NPM_DIST_TAG",
    "DETERMINISTIC_GITHUB_RELEASE_PRERELEASE_STATE",
  ],
  issues,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (issues.length > 0) process.exitCode = 1;
