import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { temporaryDirectory } from "../helpers/temporary.js";

const validatorScript = path.resolve("scripts", "validate-workflow-security.mjs");
const releaseWorkflow = await readFile(path.resolve(".github", "workflows", "release.yml"), "utf8");
const publishCommand =
  'npm publish "./${tarballs[0]}" --access public --tag alpha --ignore-scripts';
const publishIssue =
  "release.yml: npm publish must require exactly one verified tarball and use an explicit local ./ package path";
const gitleaksIssue =
  "release.yml: complete-history Gitleaks scan must be pinned, unsuppressed, sandboxed, and exactly validated";
const gitleaksConfigIssue =
  "validation/gitleaks.toml: config must extend the built-in rules without allowlists";
const releaseCheckoutIssue =
  "release.yml: release checkout must fetch complete history without persisted credentials";
const exactGitleaksConfig =
  'title = "Cydetix release history gate"\n\n[extend]\nuseDefault = true\n';

async function validateWorkflow(source: string, gitleaksConfig = exactGitleaksConfig) {
  const repository = await temporaryDirectory("cydetix-workflow-security-");
  const workflows = path.join(repository, ".github", "workflows");
  await mkdir(workflows, { recursive: true });
  await writeFile(path.join(workflows, "release.yml"), source, "utf8");
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
      "npm publish release-bundle/*.tgz --access public --tag alpha --ignore-scripts",
    ],
    [
      "an array element without ./",
      'npm publish "${tarballs[0]}" --access public --tag alpha --ignore-scripts',
    ],
    [
      "the release directory",
      "npm publish ./release-bundle --access public --tag alpha --ignore-scripts",
    ],
    [
      "a command without ignore-scripts",
      'npm publish "./${tarballs[0]}" --access public --tag alpha',
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

  it.each([
    ["shallow checkout", "fetch-depth: 0", "fetch-depth: 1"],
    ["persisted checkout credentials", "persist-credentials: false", "persist-credentials: true"],
  ])("rejects %s", async (_name, expected, replacement) => {
    const result = await validateWorkflow(replaceRequired(releaseWorkflow, expected, replacement));
    expect(result.status).toBe(1);
    expect(result.report.issues).toContain(releaseCheckoutIssue);
  });
});
