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
const historyAuditStep = release?.jobs?.["verify-release"]?.steps?.find(
  (step) => step?.name === "Reject unsanitized reachable history",
);
if (
  historyAuditStep?.env?.CYDETIX_EXPECTED_TAG !== "${{ github.ref_name }}" ||
  historyAuditStep?.run !==
    'npm run audit:history -- --enforce --ref "refs/tags/${CYDETIX_EXPECTED_TAG}"'
)
  issues.push("release.yml: Git-history privacy audit is not scoped to the validated release tag");
const npmPublishStep = publish?.steps?.find(
  (step) => step?.name === "Publish approved prerelease through npm OIDC",
);
const expectedNpmPublishScript = `shopt -s nullglob
tarballs=(release-bundle/*.tgz)
if [ "\${#tarballs[@]}" -ne 1 ]; then
  echo "Expected exactly one npm tarball, found \${#tarballs[@]}" >&2
  exit 1
fi
npm publish "./\${tarballs[0]}" --access public --tag alpha --ignore-scripts`;
if (npmPublishStep?.shell !== "bash" || npmPublishStep?.run?.trim() !== expectedNpmPublishScript)
  issues.push(
    "release.yml: npm publish must require exactly one verified tarball and use an explicit local ./ package path",
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
    "RELEASE_REACHABLE_HISTORY_SCOPE",
    "EXPLICIT_SINGLE_LOCAL_NPM_TARBALL",
  ],
  issues,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (issues.length > 0) process.exitCode = 1;
