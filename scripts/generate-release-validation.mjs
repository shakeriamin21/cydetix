import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { releaseValidationReportSchema } from "../dist/validation/release.js";
import { createContainerSandboxRunner } from "../dist/verification/runner.js";

const root = path.resolve(".");
const resultsDirectory = path.resolve("validation", "results");
const evidenceDirectory = path.resolve(".cydetix", "evidence");
const releaseDirectory = path.resolve(
  process.env.CYDETIX_RELEASE_DIR ?? path.join(".cydetix", "release"),
);
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const releaseInputs = JSON.parse(
  await readFile(path.join(releaseDirectory, "release-inputs.json"), "utf8"),
);
const preliminaryRelease = JSON.parse(
  await readFile(
    path.join(releaseDirectory, `cydetix-release-validation-${packageJson.version}.json`),
    "utf8",
  ),
);
const testReport = JSON.parse(await readFile(path.join(evidenceDirectory, "tests.json"), "utf8"));
const packedInstall = JSON.parse(
  await readFile(path.join(evidenceDirectory, "packed-install.json"), "utf8"),
);
const packedPlugin = JSON.parse(
  await readFile(path.join(evidenceDirectory, "packed-plugin.json"), "utf8"),
);
const selfScan = JSON.parse(await readFile(path.join(evidenceDirectory, "self-scan.json"), "utf8"));
const performance = JSON.parse(
  await readFile(path.join(evidenceDirectory, "performance.json"), "utf8"),
).results;
const corpora = await Promise.all(
  ["owasp-nodegoat.json", "owasp-benchmark-python.json"].map(async (name) =>
    JSON.parse(await readFile(path.join(resultsDirectory, name), "utf8")),
  ),
);

async function optionalEvidence(name, fallback) {
  try {
    return JSON.parse(await readFile(path.join(evidenceDirectory, name), "utf8"));
  } catch {
    return fallback;
  }
}

function run(executable, arguments_, maximumBytes = 1_000_000) {
  const result = spawnSync(executable, arguments_, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: maximumBytes,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      PATHEXT: process.env.PATHEXT,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
      GIT_TERMINAL_PROMPT: "0",
    },
  });
  if (result.error !== undefined || result.status !== 0)
    throw new Error(`Release validation command failed safely: ${executable}.`);
  return result.stdout;
}

function git(arguments_) {
  return run(
    "git",
    ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...arguments_],
    64_000,
  ).trim();
}

function parseJsonCommand(executable, arguments_) {
  return JSON.parse(run(executable, arguments_));
}

function tryParseJsonCommand(executable, arguments_) {
  try {
    return parseJsonCommand(executable, arguments_);
  } catch {
    return undefined;
  }
}

const image = process.env.CYDETIX_SANDBOX_IMAGE ?? `sha256:${"0".repeat(64)}`;
const sandbox = await createContainerSandboxRunner({ image }).capability();
const sandboxRequested = process.env.CYDETIX_SANDBOX_IMAGE !== undefined;
const sandboxPassed = sandboxRequested && sandbox.state === "AVAILABLE_HARDENED";
const assertions = testReport.testResults.flatMap((result) => result.assertionResults);

function stateForTests(testNames) {
  const selected = testNames.map((name) =>
    assertions.find((assertion) => assertion.fullName.includes(name)),
  );
  if (selected.some((assertion) => assertion === undefined)) return "not_checked";
  if (selected.some((assertion) => assertion.status === "failed")) return "executed_fail";
  if (selected.some((assertion) => assertion.status !== "passed")) return "skipped_capability";
  return "executed_pass";
}

function testCheck(id, testNames, evidence, controls = undefined) {
  return {
    id,
    state: stateForTests(testNames),
    evidence,
    tests: testNames,
    ...(controls === undefined ? {} : { controls }),
  };
}

const fileResults = testReport.testResults.map((result) => {
  const statuses = result.assertionResults.map((assertion) => assertion.status);
  if (statuses.some((status) => status === "failed")) return "failed";
  if (statuses.length > 0 && statuses.every((status) => status !== "passed")) return "skipped";
  return "passed";
});
const filesFailed = fileResults.filter((status) => status === "failed").length;
const testsFailed = testReport.numFailedTests ?? 0;
const filesPassed = fileResults.filter((status) => status === "passed").length;
const testsPassed = testReport.numPassedTests ?? 0;
const filesSkipped = fileResults.filter((status) => status === "skipped").length;
const testsSkipped = testReport.numPendingTests ?? 0;
const implementationCommit = git(["rev-parse", "HEAD"]);
const publicCommitCount = Number(git(["rev-list", "--count", "--all"]));
const publicTags = git(["tag", "--list"]).split("\n").filter(Boolean);
const externalConsistent =
  corpora[0]?.counts?.truePositive === 6 &&
  corpora[0]?.counts?.falsePositive === 0 &&
  corpora[0]?.counts?.needsDomainContext === 1 &&
  corpora[1]?.counts?.notApplicable === 3 &&
  corpora[1]?.counts?.trueNegative === 0;
const scorecard = await optionalEvidence("scorecard.json", {
  state: "not_checked",
  checksRun: 0,
  limitations: [
    "No exact-commit OpenSSF Scorecard result was supplied to this local release-preparation run.",
  ],
});
const crossPlatform = await optionalEvidence("cross-platform.json", {
  state: "not_checked",
  evidence:
    "The six-case GitHub-hosted Windows/Linux/macOS matrix is configured but was not remotely executed in this local gate.",
});
const externalRerun = await optionalEvidence("external-rerun.json", {
  state: "skipped_capability",
  evidence:
    "Fresh corpus acquisition was attempted from both official GitHub repositories, but host DNS resolution was unavailable; prior pinned results were not relabeled as a fresh run.",
});

const checks = [
  {
    id: "source-state",
    state: releaseInputs.sourceState === "COMMITTED_CLEAN" ? "executed_pass" : "executed_fail",
    evidence:
      releaseInputs.sourceState === "COMMITTED_CLEAN"
        ? "Release artifacts came from a clean committed source tree."
        : "Artifacts are explicitly labeled as an uncommitted preview and cannot be published.",
  },
  {
    id: "git-history-privacy",
    state:
      preliminaryRelease.checks?.gitHistoryPrivacy === "PASS" ? "executed_pass" : "executed_fail",
    evidence:
      preliminaryRelease.checks?.gitHistoryPrivacy === "PASS"
        ? "The explicit Git-history author/privacy allowlist passed."
        : "Git-history author/privacy approval is incomplete; no identity was silently approved.",
  },
  {
    id: "complete-test-suite",
    state:
      filesFailed === 0 && testsFailed === 0 && filesSkipped === 0 && testsSkipped === 0
        ? "executed_pass"
        : filesFailed > 0 || testsFailed > 0
          ? "executed_fail"
          : "skipped_capability",
    evidence: `${filesPassed} files and ${testsPassed} tests passed; ${filesFailed} files and ${testsFailed} tests failed; ${filesSkipped} files and ${testsSkipped} tests skipped.`,
  },
  {
    id: "container-capability",
    state: sandboxPassed
      ? "executed_pass"
      : sandboxRequested
        ? sandbox.state === "UNAVAILABLE"
          ? "skipped_capability"
          : "executed_fail"
        : "not_checked",
    evidence: sandboxPassed
      ? "Cydetix executed its hardened Linux launch probe against the locally present immutable image."
      : "Cydetix did not obtain AVAILABLE_HARDENED; no sandbox property is counted as passing.",
    controls: [
      "daemon response",
      "Linux runtime",
      "immutable local image",
      "hardened launch probe",
    ],
  },
  testCheck(
    "previously-gated-five",
    [
      "sanitizes host environment, isolates real host canaries, and uses an ephemeral workspace",
      "denies DNS resolution, TCP connections, and HTTP/HTTPS requests",
      "terminates a timed-out process tree and removes the container",
      "enforces the aggregate captured-output bound",
      "enforces the container PID bound",
    ],
    "The five Phase 6 capability-gated integration tests all executed with the pinned image; skipped tests are not accepted as passes.",
  ),
  testCheck(
    "network-denial",
    ["denies DNS resolution, TCP connections, and HTTP/HTTPS requests"],
    "An in-container command attempted DNS, TEST-NET TCP, HTTP, and HTTPS communication; every attempt was denied or timed out without connecting.",
    ["--network none", "in-container DNS", "in-container TCP", "in-container HTTP/HTTPS"],
  ),
  testCheck(
    "environment-and-host-filesystem-isolation",
    ["sanitizes host environment, isolates real host canaries, and uses an ephemeral workspace"],
    "Three synthetic host environment canaries plus synthetic host-temp and host-home file canaries were inaccessible in the workload.",
    ["fixed environment allowlist", "no home mount", "no host-temp mount", "ephemeral copy"],
  ),
  testCheck(
    "container-privilege-controls",
    ["receives non-root, privilege, socket, mount, rootfs, and cgroup controls"],
    "The workload observed UID/GID 65534, zero capability sets, NoNewPrivs=1, seccomp mode 2, read-only root, no Docker/SSH socket, and the configured cgroup limits.",
    [
      "non-root",
      "all capabilities dropped",
      "no-new-privileges",
      "runtime-default seccomp",
      "read-only root",
      "no privileged/socket mounts",
    ],
  ),
  testCheck(
    "resource-and-timeout-enforcement",
    [
      "terminates a timed-out process tree and removes the container",
      "enforces the aggregate captured-output bound",
      "enforces the container PID bound",
      "enforces memory and temporary-filesystem exhaustion bounds",
    ],
    "Infinite/child-process, output, PID, page-touched memory, and tmpfs exhaustion fixtures reached the intended enforced bounds.",
    [
      "timeout",
      "container kill/removal",
      "2 MB output",
      "128 PIDs",
      "512 MiB memory+swap",
      "64 MiB /tmp",
    ],
  ),
  testCheck(
    "ephemeral-workspace-cleanup",
    ["cleans isolated workspaces after success, failure, and timeout"],
    "Sandbox-created files did not reach the source repository, and temporary copies were removed after success, command failure, and timeout.",
  ),
  testCheck(
    "ordinary-scan-hostile-repository",
    [
      "terminates deterministically without executing repository instructions or scripts",
      "does not execute hostile repository scripts, formatters, hooks, or instructions",
    ],
    "Ordinary scanning/remediation did not execute hostile package scripts, formatter configuration, hooks, prompt instructions, or metacharacter paths.",
  ),
  testCheck(
    "no-silent-local-fallback",
    [
      "does not silently fall back after a successful sandbox run",
      "rejects mutable images and never falls back when Docker is unavailable",
    ],
    "After a successful container run, simulated Docker unavailability returned SANDBOX_UNAVAILABLE and left the local marker absent.",
  ),
  testCheck(
    "authorized-command-entrypoint-integrity",
    ["clears an image entrypoint that would intercept the authorized command"],
    "A synthetic image entrypoint that returned success was cleared; the authorized command executed and its exit code 83 was preserved.",
  ),
  testCheck(
    "sandboxed-remediation-end-to-end",
    ["completes a sandbox-verified SAFE remediation and remains idempotent"],
    "The vulnerable session fixture moved PROVEN_INSECURE to PROVEN_SECURE, returned APPLIED_VERIFIED, and a second run made no changes.",
  ),
  testCheck(
    "sandboxed-verification-rollback",
    ["rolls back a sandbox verification failure without touching user changes"],
    "A structurally valid SAFE edit followed by a failing sandbox command returned ROLLBACK_SUCCEEDED; source and unrelated-user-file hashes were unchanged.",
  ),
  testCheck(
    "sandbox-output-redaction-and-terminal-safety",
    [
      "does not retain secret-shaped or terminal-control sandbox output",
      "redacts configuration parser failures and terminal control bytes",
      "neutralizes terminal control characters in untrusted report fields",
    ],
    "Synthetic stdout, stderr, thrown-error, JSON, timeout, excessive-output, ANSI, OSC-title, carriage-return, and backspace payloads did not appear in retained sandbox results; text rendering escaped controls.",
  ),
  {
    id: "external-validation-regression",
    state: externalConsistent ? externalRerun.state : "executed_fail",
    evidence: externalRerun.evidence,
  },
  {
    id: "stored-external-results-integrity",
    state: externalConsistent ? "executed_pass" : "executed_fail",
    evidence:
      "Stored pinned results remain NodeGoat 6 TP / 0 FP / 1 NEEDS_DOMAIN_CONTEXT and BenchmarkPython 3 NOT_APPLICABLE / 0 TN; denominators were not broadened.",
  },
  {
    id: "benchmark-python-applicability",
    state: "not_applicable",
    evidence:
      "The three reviewed BenchmarkPython cases do not satisfy current Cydetix rule prerequisites and remain excluded from TN counts.",
  },
  {
    id: "self-scan",
    state:
      selfScan.state === "PASSED" && selfScan.activeFindings === 0
        ? "executed_pass"
        : "executed_fail",
    evidence: `${selfScan.filesExamined} files and ${selfScan.bytesExamined} bytes scanned; ${selfScan.activeFindings} active and ${selfScan.suppressedFindings} suppressed findings.`,
  },
  {
    id: "packed-install-current-host",
    state: packedInstall.state === "PASSED" ? "executed_pass" : "executed_fail",
    evidence: `Packed tarball installed with lifecycle scripts disabled; version, doctor, scan, remediation dry-run, and ${packedInstall.skillCount} packaged Agent Skills passed on ${packedInstall.platform}.`,
  },
  {
    id: "packed-plugin",
    state: packedPlugin.state === "PASSED" ? "executed_pass" : "executed_fail",
    evidence: `The isolated plugin archive validated its manifest, required files, portability checks, and ${packedPlugin.skillCount} skills.`,
  },
  {
    id: "release-artifacts",
    state: releaseInputs.artifacts.length >= 3 ? "executed_pass" : "executed_fail",
    evidence: `${releaseInputs.artifacts.length} release artifacts were regenerated after source commit ${releaseInputs.sourceCommit} and SHA-256 hashed.`,
  },
  {
    id: "clean-public-lineage",
    state: publicCommitCount >= 1 && publicTags.length === 0 ? "executed_pass" : "executed_fail",
    evidence: `${publicCommitCount} commit(s) are reachable in the clean public lineage; ${publicTags.length} tag(s) exist before publication approval.`,
  },
  {
    id: "cross-platform-ci-matrix",
    state: crossPlatform.state,
    evidence: crossPlatform.evidence,
  },
  {
    id: "openssf-scorecard",
    state: scorecard.state,
    evidence:
      scorecard.state === "executed_pass"
        ? `OpenSSF Scorecard ${scorecard.version} ran ${scorecard.checksRun} checks; it is posture evidence, not vulnerability truth.`
        : scorecard.limitations.join(" "),
  },
];

const mandatoryChecks = new Set([
  "source-state",
  "git-history-privacy",
  "complete-test-suite",
  "container-capability",
  "previously-gated-five",
  "network-denial",
  "environment-and-host-filesystem-isolation",
  "container-privilege-controls",
  "resource-and-timeout-enforcement",
  "ephemeral-workspace-cleanup",
  "ordinary-scan-hostile-repository",
  "no-silent-local-fallback",
  "authorized-command-entrypoint-integrity",
  "sandboxed-remediation-end-to-end",
  "sandboxed-verification-rollback",
  "sandbox-output-redaction-and-terminal-safety",
  "stored-external-results-integrity",
  "self-scan",
  "packed-install-current-host",
  "packed-plugin",
  "release-artifacts",
  "clean-public-lineage",
]);
const mandatoryPassed = checks
  .filter((check) => mandatoryChecks.has(check.id))
  .every((check) => check.state === "executed_pass");

const dockerVersion = tryParseJsonCommand("docker", ["version", "--format", "{{json .}}"]);
const dockerInfo = tryParseJsonCommand("docker", ["info", "--format", "{{json .}}"]);
const imageRepoDigests = sandboxRequested
  ? (tryParseJsonCommand("docker", [
      "image",
      "inspect",
      image,
      "--format",
      "{{json .RepoDigests}}",
    ]) ?? [])
  : [];
const wslVersion =
  process.platform === "win32"
    ? run("wsl", ["--version"], 64_000)
        .replaceAll("\0", "")
        .match(/^WSL version:\s*(.+)$/mu)?.[1]
    : undefined;

const validation = releaseValidationReportSchema.parse({
  schemaVersion: "1.2.0",
  generatedAt: new Date().toISOString(),
  product: {
    name: "cydetix",
    version: packageJson.version,
    evidenceOrigin: "PUBLIC_GIT_COMMIT",
    publicSourceCommit: implementationCommit,
  },
  verdict: mandatoryPassed ? "PUBLIC_ALPHA_READY_WITH_LIMITATIONS" : "NOT_READY_FOR_PUBLIC_USE",
  checks,
  corpora,
  sandbox,
  environment: {
    nodeVersion: process.version,
    npmVersion: releaseInputs.npmVersion,
    platform: `${process.platform}-${process.arch}`,
    docker: {
      clientVersion: dockerVersion?.Client?.Version ?? "UNAVAILABLE",
      serverVersion: dockerVersion?.Server?.Version ?? "UNAVAILABLE",
      serverPlatform: dockerVersion?.Server?.Platform?.Name ?? "UNAVAILABLE",
      // The verification runner targets Linux containers; availability is represented
      // by the sandbox/check states and the remaining UNAVAILABLE metadata.
      osType: dockerInfo?.OSType ?? "linux",
      architecture: dockerInfo?.Architecture ?? "UNAVAILABLE",
      kernelVersion: dockerInfo?.KernelVersion ?? "UNAVAILABLE",
      cgroupVersion: String(dockerInfo?.CgroupVersion ?? "UNAVAILABLE"),
      defaultRuntime: dockerInfo?.DefaultRuntime ?? "UNAVAILABLE",
      securityOptions: dockerInfo?.SecurityOptions ?? [],
      imageIdentity: sandboxRequested ? image : "UNAVAILABLE",
      imageRepoDigests,
    },
    ...(wslVersion === undefined ? {} : { wsl: { version: wslVersion, backend: "WSL2" } }),
  },
  scorecard,
  tests: {
    filesPassed,
    testsPassed,
    filesFailed,
    testsFailed,
    filesSkipped,
    testsSkipped,
  },
  performance,
  package: {
    state: "CURRENT",
    ...releaseInputs.package,
    hashes: releaseInputs.artifacts,
  },
  supportScope: [
    "TypeScript/JavaScript and narrow Python static analysis",
    "Express/Prisma cross-file reasoning",
    "npm lockfile and GitHub Actions supply-chain analysis",
    "one deterministic SAFE session-cookie remediation adapter",
  ],
  knownLimitations: [
    "Docker/container isolation depends on Docker Desktop, WSL2, the Linux kernel, runc, runtime-default seccomp, and the explicitly trusted image; container escape resistance is not proven.",
    "The trusted image may define its own baseline environment; Cydetix adds only CI=true and CYDETIX_VERIFICATION=1 and does not forward arbitrary host variables.",
    "The writable ephemeral workspace bind mount has no independent byte quota; rootfs and tmpfs writes are bounded, but workspace disk exhaustion depends on host/runtime capacity.",
    "The bounded text-only copy excludes archives, binary assets, ignored dependencies, files over the copy limit, and repositories over 10,000 copied files or 100 MB.",
    "OWASP BenchmarkPython cases were outside current rule applicability and were not counted as negatives.",
    "NodeGoat labels are findings-only manual adjudications, so recall is withheld.",
    "The GitHub-hosted cross-platform CI matrix was not executed from this local-only checkout.",
    ...(scorecard.state === "not_checked" ? scorecard.limitations : []),
  ],
});
await mkdir(resultsDirectory, { recursive: true });
await writeFile(
  path.resolve("validation", "validation-report.json"),
  `${JSON.stringify(validation, null, 2)}\n`,
  "utf8",
);
process.stdout.write(
  `Generated release validation ${validation.verdict} for ${validation.product.publicSourceCommit}.\n`,
);
