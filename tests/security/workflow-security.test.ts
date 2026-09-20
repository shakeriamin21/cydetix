import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { temporaryDirectory } from "../helpers/temporary.js";

const validatorScript = path.resolve("scripts", "validate-workflow-security.mjs");
const releaseWorkflow = await readFile(path.resolve(".github", "workflows", "release.yml"), "utf8");
const releaseChannelResolver = await readFile(
  path.resolve("scripts", "resolve-release-channel.mjs"),
  "utf8",
);
const publishCommand =
  'npm publish "./${tarballs[0]}" --access public --tag "$npm_dist_tag" --ignore-scripts';
const publishIssue =
  "release.yml: npm publish must require one verified local tarball and the deterministic version-derived dist-tag";
const githubDraftIssue =
  "release.yml: draft GitHub release must derive prerelease state from the package version";
const githubPublishIssue =
  "release.yml: final GitHub release must explicitly retain or clear prerelease state from the package version";
const gitleaksIssue =
  "release.yml: complete-history Gitleaks scan must be pinned, unsuppressed, sandboxed, and exactly validated";
const gitleaksConfigIssue =
  "validation/gitleaks.toml: config must extend the built-in rules without allowlists";
const evidenceStateIssue =
  "release.yml: release artifacts must explicitly inherit successful OSV and independent secret-scan gates";
const releaseCheckoutIssue =
  "release.yml: release checkout must fetch complete history without persisted credentials";
const exactGitleaksConfig =
  'title = "Cydetix release history gate"\n\n[extend]\nuseDefault = true\n';

async function validateWorkflow(source: string, gitleaksConfig = exactGitleaksConfig) {
  const repository = await temporaryDirectory("cydetix-workflow-security-");
  const workflows = path.join(repository, ".github", "workflows");
  await mkdir(workflows, { recursive: true });
  await writeFile(path.join(workflows, "release.yml"), source, "utf8");
  await mkdir(path.join(repository, "scripts"), { recursive: true });
  await writeFile(
    path.join(repository, "scripts", "resolve-release-channel.mjs"),
    releaseChannelResolver,
    "utf8",
  );
  await mkdir(path.join(repository, "validation"), { recursive: true });
  await writeFile(path.join(repository, "validation", "gitleaks.toml"), gitleaksConfig, "utf8");
  const result = spawnSync(process.execPath, [validatorScript], {
    cwd: repository,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 20_000,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      PATHEXT: process.env.PATHEXT,
    },
  });
  if (result.error !== undefined) throw result.error;
  return {
    status: result.status,
    report: JSON.parse(result.stdout) as { state: string; controls: string[]; issues: string[] },
  };
}

function replaceRequired(source: string, expected: string, replacement: string): string {
  expect(source).toContain(expected);
  return source.replace(expected, replacement);
}

describe("release workflow npm package spec", () => {
  it("accepts the exact single-tarball explicit-local publish boundary", async () => {
    const result = await validateWorkflow(releaseWorkflow);
    expect(result.status).toBe(0);
    expect(result.report.state).toBe("PASS");
    expect(result.report.controls).toContain("EXPLICIT_SINGLE_LOCAL_NPM_TARBALL");
  });

  it.each([
    [
      "a bare relative glob",
      'npm publish release-bundle/*.tgz --access public --tag "$npm_dist_tag" --ignore-scripts',
    ],
    [
      "an array element without ./",
      'npm publish "${tarballs[0]}" --access public --tag "$npm_dist_tag" --ignore-scripts',
    ],
    [
      "the release directory",
      'npm publish ./release-bundle --access public --tag "$npm_dist_tag" --ignore-scripts',
    ],
    [
      "a command without ignore-scripts",
      'npm publish "./${tarballs[0]}" --access public --tag "$npm_dist_tag"',
    ],
    [
      "a hard-coded channel",
      'npm publish "./${tarballs[0]}" --access public --tag beta --ignore-scripts',
    ],
  ])("rejects %s as the publish package spec", async (_name, unsafeCommand) => {
    const result = await validateWorkflow(
      replaceRequired(releaseWorkflow, publishCommand, unsafeCommand),
    );
    expect(result.status).toBe(1);
    expect(result.report.issues).toContain(publishIssue);
  });

  it("rejects a publish block that does not require exactly one tarball", async () => {
    const weakened = replaceRequired(
      releaseWorkflow,
      'if [ "${#tarballs[@]}" -ne 1 ]; then',
      'if [ "${#tarballs[@]}" -lt 1 ]; then',
    );
    const result = await validateWorkflow(weakened);
    expect(result.status).toBe(1);
    expect(result.report.issues).toContain(publishIssue);
  });

  it("rejects a release workflow that does not derive the channel from package version", async () => {
    const weakened = replaceRequired(
      releaseWorkflow,
      'npm_dist_tag="$(node scripts/resolve-release-channel.mjs --npm-dist-tag)"',
      'npm_dist_tag="beta"',
    );
    const result = await validateWorkflow(weakened);
    expect(result.status).toBe(1);
    expect(result.report.issues).toContain(publishIssue);
  });
});

describe("release workflow GitHub prerelease semantics", () => {
  it("requires deterministic prerelease handling for draft and final publication", async () => {
    const result = await validateWorkflow(releaseWorkflow);
    expect(result.status).toBe(0);
    expect(result.report.controls).toContain("DETERMINISTIC_GITHUB_RELEASE_PRERELEASE_STATE");
  });

  it("rejects a draft release that is always marked prerelease", async () => {
    const weakened = replaceRequired(
      releaseWorkflow,
      'github_prerelease="$(node scripts/resolve-release-channel.mjs --github-prerelease)"',
      'github_prerelease="true"',
    );
    const result = await validateWorkflow(weakened);
    expect(result.status).toBe(1);
    expect(result.report.issues).toContain(githubDraftIssue);
  });

  it("rejects finalization that retains prerelease state for stable releases", async () => {
    const weakened = replaceRequired(
      releaseWorkflow,
      'gh release edit "$GITHUB_REF_NAME" --draft=false --prerelease="$github_prerelease"',
      'gh release edit "$GITHUB_REF_NAME" --draft=false --prerelease=true',
    );
    const result = await validateWorkflow(weakened);
    expect(result.status).toBe(1);
    expect(result.report.issues).toContain(githubPublishIssue);
  });

  it("rejects a draft release that omits prerelease state for alpha and beta", async () => {
    const weakened = replaceRequired(
      releaseWorkflow,
      "          prerelease_args+=(--prerelease)",
      "          :",
    );
    const result = await validateWorkflow(weakened);
    expect(result.status).toBe(1);
    expect(result.report.issues).toContain(githubDraftIssue);
  });
});

describe("release workflow trusted-publishing controls", () => {
  it.each([
    ["environment: release", "environment: staging", "protected release environment"],
    ["id-token: write", "id-token: read", "publish permission id-token must be write"],
    ["contents: write", "contents: read", "publish permission contents must be write"],
    ["attestations: write", "attestations: read", "publish permission attestations must be write"],
  ])("rejects weakened %s", async (expected, replacement, issueFragment) => {
    const result = await validateWorkflow(replaceRequired(releaseWorkflow, expected, replacement));
    expect(result.status).toBe(1);
    expect(result.report.issues.some((issue) => issue.includes(issueFragment))).toBe(true);
  });

  it("rejects a long-lived npm token fallback", async () => {
    const weakened = replaceRequired(
      releaseWorkflow,
      'registry-url: "https://registry.npmjs.org"',
      'registry-url: "https://registry.npmjs.org"\n          npm-token: ${{ secrets.NPM_TOKEN }}',
    );
    const result = await validateWorkflow(weakened);
    expect(result.status).toBe(1);
    expect(result.report.issues).toContain(
      ".github/workflows/release.yml: long-lived npm token reference is forbidden",
    );
  });
});

describe("release workflow exact-commit hosted gates", () => {
  it("requires CI, CodeQL, and OpenSSF", async () => {
    const result = await validateWorkflow(releaseWorkflow);
    expect(result.status).toBe(0);
    expect(result.report.controls).toContain("EXACT_COMMIT_CI_CODEQL_OPENSSF_GATES");
  });

  it.each([
    ["ci.yml", "ci-weakened.yml"],
    ["codeql.yml", "codeql-weakened.yml"],
    ["scorecard.yml", "scorecard-weakened.yml"],
  ])("rejects a missing or changed %s exact-commit gate", async (expected, replacement) => {
    const result = await validateWorkflow(replaceRequired(releaseWorkflow, expected, replacement));
    expect(result.status).toBe(1);
    expect(result.report.issues).toContain(
      `release.yml: ${expected} exact-commit success gate is missing or weakened`,
    );
  });
});

describe("release workflow complete-history secret scan", () => {
  it("accepts the pinned unsuppressed scan and exact default-rule config", async () => {
    const result = await validateWorkflow(releaseWorkflow);
    expect(result.status).toBe(0);
    expect(result.report.controls).toContain("PINNED_UNSUPPRESSED_COMPLETE_HISTORY_SECRET_SCAN");
  });

  it.each([
    ["inline-allow bypass", " --ignore-gitleaks-allow", ""],
    ["target-controlled ignore bypass", " --gitleaks-ignore-path /dev/null", ""],
    ["source-root ignore bypass", "if [ -e .gitleaksignore ]", "if [ -f .gitleaksignore ]"],
    ["target-controlled config bypass", " --config /repo/validation/gitleaks.toml", ""],
    [
      "implicit history scope",
      ' --log-opts="--full-history --all --text --no-textconv --no-ext-diff"',
      "",
    ],
    ["attribute-controlled binary omission", "--all --text --no-textconv", "--all --no-textconv"],
    [
      "type-change omission",
      "--all --text --no-textconv",
      "--all --diff-filter=tuxdb --text --no-textconv",
    ],
    ["incomplete history scan", "git /repo --redact=100", "dir /repo --redact=100"],
    [
      "mutable scanner image",
      "@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f \\",
      "@sha256:d00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f \\",
    ],
  ])("rejects a %s", async (_name, expected, replacement) => {
    const result = await validateWorkflow(replaceRequired(releaseWorkflow, expected, replacement));
    expect(result.status).toBe(1);
    expect(result.report.issues).toContain(gitleaksIssue);
  });

  it("rejects a Gitleaks config that does not exactly extend built-in defaults", async () => {
    const result = await validateWorkflow(releaseWorkflow, "[allowlist]\npaths = ['docs/']\n");
    expect(result.status).toBe(1);
    expect(result.report.issues).toContain(gitleaksConfigIssue);
  });

  it.each(["CYDETIX_OSV_STATE: PASS", "CYDETIX_INDEPENDENT_SECRET_SCAN_STATE: PASS"])(
    "rejects a missing %s evidence handoff",
    async (declaration) => {
      const result = await validateWorkflow(replaceRequired(releaseWorkflow, declaration, ""));
      expect(result.status).toBe(1);
      expect(result.report.issues).toContain(evidenceStateIssue);
    },
  );

  it.each([
    ["shallow checkout", "fetch-depth: 0", "fetch-depth: 1"],
    ["persisted checkout credentials", "persist-credentials: false", "persist-credentials: true"],
  ])("rejects %s", async (_name, expected, replacement) => {
    const result = await validateWorkflow(replaceRequired(releaseWorkflow, expected, replacement));
    expect(result.status).toBe(1);
    expect(result.report.issues).toContain(releaseCheckoutIssue);
  });
});
