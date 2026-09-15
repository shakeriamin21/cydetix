import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { format } from "prettier";

import { createContainerSandboxRunner } from "../dist/verification/runner.js";

const image = process.env.CYDETIX_SANDBOX_IMAGE;
if (image === undefined) throw new Error("CYDETIX_SANDBOX_IMAGE is required.");
const expectedImage =
  "node@sha256:1b2479dd35a99687d6638f5976fd235e26c5b37e8122f786fcd5fe231d63de5b";
if (image !== expectedImage)
  throw new Error("The V1 cleanup stress gate requires the pinned image.");

const sourceState = spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], {
  encoding: "utf8",
  shell: false,
  windowsHide: true,
  timeout: 10_000,
});
if (sourceState.error !== undefined || sourceState.status !== 0)
  throw new Error("The stress report could not inspect the source tree state.");
if (sourceState.stdout.trim() !== "")
  throw new Error("The Docker cleanup stress gate requires a clean exact source commit.");

function docker(arguments_, acceptedStatuses = [0]) {
  const result = spawnSync("docker", arguments_, {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 2_000_000,
  });
  if (result.error !== undefined || !acceptedStatuses.includes(result.status))
    throw new Error(`Docker command failed: ${arguments_[0] ?? "unknown"}.`);
  return result.stdout.trim();
}

function dockerGitHead() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 10_000,
  });
  if (
    result.error !== undefined ||
    result.status !== 0 ||
    !/^[a-f0-9]{40}\n?$/u.test(result.stdout)
  )
    throw new Error("The stress report could not resolve its source commit.");
  return result.stdout.trim();
}

function verificationContainers() {
  return docker(["ps", "-a", "--filter", "name=cydetix-verify-", "--format", "{{.Names}}"])
    .split("\n")
    .filter(Boolean);
}

const baselineContainers = verificationContainers();
if (baselineContainers.length > 0)
  throw new Error("Pre-existing Cydetix verification containers make the stress audit ambiguous.");

const root = await mkdtemp(path.join(os.tmpdir(), "cydetix-v1-cleanup-stress-"));
const started = performance.now();
const totalRuns = 50;
const parallelism = 5;
const outcomes = [];
const leakedContainers = new Set();
try {
  await writeFile(path.join(root, "baseline.txt"), "bounded sandbox fixture\n", "utf8");
  const runner = createContainerSandboxRunner({ image });
  const capability = await runner.capability();
  if (capability.state !== "AVAILABLE_HARDENED")
    throw new Error(`Hardened sandbox is unavailable: ${capability.state}.`);

  for (let offset = 0; offset < totalRuns; offset += parallelism) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(parallelism, totalRuns - offset) }, (_, index) => {
        const run = offset + index;
        return runner.run(root, {
          executable: "node",
          arguments: [
            "-e",
            run % 2 === 0
              ? "setInterval(()=>{},1000)"
              : "require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)']);setInterval(()=>{},1000)",
          ],
          workingDirectory: ".",
          timeoutMilliseconds: run % 2 === 0 ? 1 : 75,
          networkPolicy: "DENIED",
        });
      }),
    );
    outcomes.push(...batch.map((result) => result.state));
    for (const name of verificationContainers()) leakedContainers.add(name);
  }
} finally {
  await rm(root, { recursive: true, force: true });
}

for (const name of verificationContainers()) leakedContainers.add(name);
const exactLeaks = [...leakedContainers].filter((name) =>
  /^cydetix-verify-[a-f0-9-]+$/u.test(name),
);
if (exactLeaks.length > 0) docker(["rm", "--force", ...exactLeaks]);

const dockerVersion = JSON.parse(docker(["version", "--format", "{{json .}}"]));
const dockerInfo = JSON.parse(docker(["info", "--format", "{{json .}}"]));
const imageIdentity = JSON.parse(docker(["image", "inspect", image, "--format", "{{json .}}"]));
const passed = outcomes.filter((state) => state === "TIMED_OUT").length;
const cleanupFailures = outcomes.filter((state) => state === "SANDBOX_MISCONFIGURED").length;
const report = {
  schemaVersion: "1.0.0",
  sourceCommit: dockerGitHead(),
  historicalFailure: {
    state: "OBSERVED_BEFORE_REMEDIATION",
    suiteResult: "12/13",
    workloadResult: "TIMED_OUT",
    leakedContainerState: "Created",
    rootCause:
      "The combined docker run client was killed before daemon-side creation necessarily completed; an immediate empty docker ps result was accepted before the delayed container appeared.",
  },
  remediation:
    "Synchronous create and hardened inspection precede bounded start --attach. Exact-name rm --force covers every container state, retries transient failures, verifies absence, and converts unconfirmed cleanup to SANDBOX_MISCONFIGURED.",
  totalRuns,
  parallelism,
  timeoutProfilesMilliseconds: [1, 75],
  passed,
  cleanupFailures,
  unexpectedStates: outcomes.filter((state) => state !== "TIMED_OUT"),
  leakedContainerCount: leakedContainers.size,
  leakedContainers: [...leakedContainers],
  durationMilliseconds: performance.now() - started,
  environment: {
    platform: `${process.platform}-${process.arch}`,
    node: process.version,
    dockerClient: dockerVersion.Client?.Version ?? null,
    dockerServer: dockerVersion.Server?.Version ?? null,
    dockerProduct: dockerInfo.OperatingSystem ?? null,
    dockerDesktopVersion: "NOT_REPORTED_BY_DOCKER_INFO",
    dockerName: dockerInfo.Name ?? null,
    operatingSystem: dockerInfo.OperatingSystem ?? null,
    osType: dockerInfo.OSType ?? null,
    architecture: dockerInfo.Architecture ?? null,
    kernelVersion: dockerInfo.KernelVersion ?? null,
    cgroupVersion: dockerInfo.CgroupVersion ?? null,
    defaultRuntime: dockerInfo.DefaultRuntime ?? null,
    securityOptions: dockerInfo.SecurityOptions ?? [],
    image,
    imageId: imageIdentity.Id ?? null,
    imageRepoDigests: imageIdentity.RepoDigests ?? [],
  },
  environmentAssumptions: [
    "The local Docker daemon and runc/kernel boundary are trusted; container isolation is defense in depth, not a perfect hostile-native-code boundary.",
    "The exact digest-pinned Linux image is already present locally and is never pulled implicitly.",
    "Linux memory, PID, cgroup v2, runtime-default seccomp, network-none, read-only-rootfs, non-root, capability-drop, and no-new-privileges controls are available.",
    "The daemon provides exact-name create, inspect, kill, force-remove, and list semantics; control-plane calls remain bounded and cleanup failure is reported.",
    "No pre-existing cydetix-verify-* container is allowed when the stress gate starts.",
  ],
  state:
    passed === totalRuns && cleanupFailures === 0 && leakedContainers.size === 0
      ? "PASSED"
      : "FAILED",
};
await writeFile(
  "validation/v1-readiness/docker-cleanup-stress.json",
  await format(JSON.stringify(report), { parser: "json", printWidth: 100 }),
  "utf8",
);
if (report.state !== "PASSED") throw new Error("Docker cleanup stress gate failed.");
process.stdout.write(
  `Docker cleanup stress PASSED: ${passed}/${totalRuns}; cleanup failures ${cleanupFailures}; leaked containers ${leakedContainers.size}.\n`,
);
