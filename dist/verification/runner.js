import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { stableFingerprint } from "../core/hash.js";
import { createBoundary, resolveInside } from "../repository-discovery/boundary.js";
import { DEFAULT_CONFIG } from "../repository-discovery/config.js";
import { traverseRepository } from "../repository-discovery/traverse.js";
import { sandboxCapabilitySchema, verificationCommandSchema, verificationExecutionResultSchema, } from "./model.js";
const MAX_OUTPUT_BYTES = 2_000_000;
const MAX_COPY_FILES = 10_000;
const MAX_COPY_BYTES = 100_000_000;
const PINNED_IMAGE = /^(?:[a-z0-9._/-]+@)?sha256:[a-f0-9]{64}$/u;
function commandFingerprint(command) {
    return stableFingerprint([
        command.executable,
        ...command.arguments,
        command.workingDirectory,
        String(command.timeoutMilliseconds),
        command.networkPolicy,
    ]);
}
function baseControls(kind) {
    return {
        network: kind === "CONTAINER_SANDBOX" ? "DENIED" : "NOT_ISOLATED",
        environment: kind === "NO_EXECUTION" ? "HOST_INHERITED" : "SANITIZED",
        workspace: kind === "CONTAINER_SANDBOX" ? "EPHEMERAL_COPY" : "PRIMARY_REPOSITORY",
        containerRoot: kind === "CONTAINER_SANDBOX" ? "READ_ONLY" : "NOT_APPLICABLE",
        dockerSocketMounted: false,
        sshAgentMounted: false,
        privileged: false,
        nonRoot: kind === "CONTAINER_SANDBOX",
        noNewPrivileges: kind === "CONTAINER_SANDBOX",
        capabilitiesDropped: kind === "CONTAINER_SANDBOX",
        seccomp: kind === "CONTAINER_SANDBOX" ? "RUNTIME_DEFAULT" : "NOT_APPLICABLE",
        ...(kind === "CONTAINER_SANDBOX" ? { memoryMegabytes: 512, cpuCount: 1, pidLimit: 128 } : {}),
        outputBytes: MAX_OUTPUT_BYTES,
        timeoutMilliseconds: 120_000,
    };
}
function noExecutionCapability() {
    return sandboxCapabilitySchema.parse({
        schemaVersion: "1.0.0",
        runner: "NO_EXECUTION",
        state: "UNAVAILABLE",
        runtime: "none",
        controls: baseControls("NO_EXECUTION"),
        limitations: ["Execution is disabled by policy."],
    });
}
export function createNoExecutionRunner() {
    return {
        kind: "NO_EXECUTION",
        capability() {
            return Promise.resolve(noExecutionCapability());
        },
        run(_repositoryRoot, commandInput) {
            const command = verificationCommandSchema.parse(commandInput);
            return Promise.resolve(verificationExecutionResultSchema.parse({
                schemaVersion: "1.0.0",
                runner: "NO_EXECUTION",
                state: "NOT_RUN",
                commandFingerprint: commandFingerprint(command),
                exitCode: null,
                durationMilliseconds: 0,
                stdoutBytes: 0,
                stderrBytes: 0,
                outputTruncated: false,
                capability: noExecutionCapability(),
                message: "No execution policy is active; the command remained inert.",
            }));
        },
    };
}
function localEnvironment() {
    return {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        PATHEXT: process.env.PATHEXT,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        CI: "true",
        VIBESHIELD_VERIFICATION: "1",
    };
}
export function createLocalExplicitRunner() {
    const capability = sandboxCapabilitySchema.parse({
        schemaVersion: "1.0.0",
        runner: "LOCAL_EXPLICIT",
        state: "AVAILABLE_DEGRADED",
        runtime: "host-process",
        runtimeVersion: process.version,
        controls: baseControls("LOCAL_EXPLICIT"),
        limitations: [
            "Explicit local execution is not a filesystem, network, or process sandbox.",
            "Use only for commands independently trusted by the user.",
        ],
    });
    return {
        kind: "LOCAL_EXPLICIT",
        capability() {
            return Promise.resolve(capability);
        },
        async run(repositoryRoot, commandInput) {
            const command = verificationCommandSchema.parse(commandInput);
            const started = performance.now();
            const workingDirectory = resolveInside(await createBoundary(repositoryRoot), command.workingDirectory);
            const execution = spawnSync(command.executable, [...command.arguments], {
                cwd: workingDirectory,
                env: localEnvironment(),
                encoding: "buffer",
                shell: false,
                windowsHide: true,
                timeout: command.timeoutMilliseconds,
                maxBuffer: MAX_OUTPUT_BYTES,
                stdio: ["ignore", "pipe", "pipe"],
            });
            const stdoutBytes = execution.stdout.length;
            const stderrBytes = execution.stderr.length;
            const timedOut = execution.error?.code === "ETIMEDOUT";
            const tooLarge = execution.error?.code === "ENOBUFS";
            const state = timedOut
                ? "TIMED_OUT"
                : tooLarge
                    ? "OUTPUT_LIMIT_EXCEEDED"
                    : execution.error === undefined && execution.status === 0
                        ? "SUCCEEDED"
                        : "COMMAND_FAILED";
            return verificationExecutionResultSchema.parse({
                schemaVersion: "1.0.0",
                runner: "LOCAL_EXPLICIT",
                state,
                commandFingerprint: commandFingerprint(command),
                exitCode: execution.status,
                durationMilliseconds: performance.now() - started,
                stdoutBytes,
                stderrBytes,
                outputTruncated: tooLarge,
                capability,
                message: state === "SUCCEEDED"
                    ? "Explicit local command passed; captured output was discarded."
                    : "Explicit local command failed within bounded capture; captured output was discarded.",
            });
        },
    };
}
function dockerEnvironment(configurationDirectory) {
    return {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        PATHEXT: process.env.PATHEXT,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        DOCKER_CONFIG: configurationDirectory,
    };
}
function removeAndConfirmContainer(dockerExecutable, containerName, environment) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        spawnSync(dockerExecutable, ["rm", "--force", containerName], {
            env: environment,
            shell: false,
            windowsHide: true,
            timeout: 5_000,
            stdio: "ignore",
        });
        const remaining = spawnSync(dockerExecutable, ["ps", "-a", "--no-trunc", "--filter", `name=^/${containerName}$`, "--quiet"], {
            env: environment,
            encoding: "utf8",
            shell: false,
            windowsHide: true,
            timeout: 5_000,
            maxBuffer: 64_000,
        });
        if (remaining.error === undefined && remaining.status === 0 && remaining.stdout.trim() === "")
            return true;
        if (attempt < 2)
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
    return false;
}
async function copyEphemeralRepository(sourceRoot, temporaryRoot) {
    const parent = temporaryRoot === undefined ? os.tmpdir() : path.resolve(temporaryRoot);
    await mkdir(parent, { recursive: true });
    const destination = await mkdtemp(path.join(parent, "vibeshield-sandbox-"));
    await chmod(destination, 0o777).catch(() => undefined);
    try {
        const boundary = await createBoundary(sourceRoot);
        const traversal = await traverseRepository(boundary, {
            ...DEFAULT_CONFIG,
            maxFiles: MAX_COPY_FILES,
            maxFileBytes: Math.min(DEFAULT_CONFIG.maxFileBytes, MAX_COPY_BYTES),
            maxDepth: Math.max(DEFAULT_CONFIG.maxDepth, 64),
        });
        const totalBytes = traversal.files.reduce((sum, file) => sum + file.size, 0);
        if (traversal.files.length >= MAX_COPY_FILES || totalBytes > MAX_COPY_BYTES)
            throw new Error("Verification workspace exceeds the bounded copy policy.");
        for (const file of traversal.files) {
            const target = path.join(destination, ...file.relativePath.split("/"));
            await mkdir(path.dirname(target), { recursive: true });
            await chmod(path.dirname(target), 0o777).catch(() => undefined);
            await writeFile(target, file.text, { encoding: "utf8", mode: 0o666 });
            await chmod(target, 0o666).catch(() => undefined);
        }
        return destination;
    }
    catch (error) {
        await rm(destination, { recursive: true, force: true });
        throw error;
    }
}
export function buildContainerArguments(image, containerName, workspace, command) {
    const relativeWorkdir = command.workingDirectory.replaceAll("\\", "/");
    const workdir = path.posix.resolve("/workspace", relativeWorkdir);
    if (workdir !== "/workspace" && !workdir.startsWith("/workspace/"))
        throw new Error("Working directory escapes workspace.");
    return [
        "run",
        "--rm",
        "--pull",
        "never",
        "--name",
        containerName,
        "--entrypoint=",
        "--network",
        "none",
        "--read-only",
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,size=64m",
        "--tmpfs",
        "/run:rw,noexec,nosuid,size=16m",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges=true",
        "--pids-limit",
        "128",
        "--memory",
        "512m",
        "--memory-swap",
        "512m",
        "--cpus",
        "1",
        "--user",
        "65534:65534",
        "--env",
        "CI=true",
        "--env",
        "VIBESHIELD_VERIFICATION=1",
        "--workdir",
        workdir,
        "--mount",
        `type=bind,src=${workspace},dst=/workspace`,
        image,
        command.executable,
        ...command.arguments,
    ];
}
async function runBoundedProcess(executable, arguments_, environment, timeoutMilliseconds, onTerminate) {
    return new Promise((resolve) => {
        let stdoutBytes = 0;
        let stderrBytes = 0;
        let timedOut = false;
        let outputExceeded = false;
        let spawnFailed = false;
        let settled = false;
        const child = spawn(executable, [...arguments_], {
            env: environment,
            shell: false,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
        });
        const terminate = () => {
            onTerminate?.();
            child.kill("SIGKILL");
        };
        const inspect = (kind, chunk) => {
            if (kind === "stdout")
                stdoutBytes += chunk.length;
            else
                stderrBytes += chunk.length;
            if (stdoutBytes + stderrBytes > MAX_OUTPUT_BYTES && !outputExceeded) {
                outputExceeded = true;
                terminate();
            }
        };
        child.stdout.on("data", (chunk) => inspect("stdout", chunk));
        child.stderr.on("data", (chunk) => inspect("stderr", chunk));
        child.on("error", () => {
            spawnFailed = true;
        });
        const timer = setTimeout(() => {
            timedOut = true;
            terminate();
        }, timeoutMilliseconds);
        child.on("close", (code) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            const reportedStdoutBytes = Math.min(stdoutBytes, MAX_OUTPUT_BYTES);
            const reportedStderrBytes = Math.min(stderrBytes, MAX_OUTPUT_BYTES - reportedStdoutBytes);
            resolve({
                exitCode: code,
                stdoutBytes: reportedStdoutBytes,
                stderrBytes: reportedStderrBytes,
                timedOut,
                outputExceeded,
                spawnFailed,
            });
        });
    });
}
export function createContainerSandboxRunner(options) {
    const docker = options.dockerExecutable ?? "docker";
    let cachedCapability;
    const inspectCapability = async () => {
        if (cachedCapability !== undefined)
            return cachedCapability;
        if (!PINNED_IMAGE.test(options.image)) {
            cachedCapability = sandboxCapabilitySchema.parse({
                schemaVersion: "1.0.0",
                runner: "CONTAINER_SANDBOX",
                state: "MISCONFIGURED",
                runtime: "docker",
                controls: baseControls("CONTAINER_SANDBOX"),
                limitations: ["Container image must be an immutable sha256 digest."],
            });
            return cachedCapability;
        }
        const configurationDirectory = await mkdtemp(path.join(os.tmpdir(), "vibeshield-docker-"));
        let probeWorkspace;
        let probeContainerName;
        try {
            const environment = dockerEnvironment(configurationDirectory);
            const version = spawnSync(docker, ["version", "--format", "{{.Server.Version}}"], {
                env: environment,
                encoding: "utf8",
                shell: false,
                windowsHide: true,
                timeout: 10_000,
                maxBuffer: 64_000,
            });
            if (version.error !== undefined || version.status !== 0) {
                cachedCapability = sandboxCapabilitySchema.parse({
                    schemaVersion: "1.0.0",
                    runner: "CONTAINER_SANDBOX",
                    state: "UNAVAILABLE",
                    runtime: "docker",
                    controls: baseControls("CONTAINER_SANDBOX"),
                    limitations: ["Docker engine is unavailable; local execution was not attempted."],
                });
                return cachedCapability;
            }
            const image = spawnSync(docker, ["image", "inspect", options.image, "--format", "{{.Id}}"], {
                env: environment,
                encoding: "utf8",
                shell: false,
                windowsHide: true,
                timeout: 10_000,
                maxBuffer: 64_000,
            });
            if (image.error !== undefined || image.status !== 0) {
                cachedCapability = sandboxCapabilitySchema.parse({
                    schemaVersion: "1.0.0",
                    runner: "CONTAINER_SANDBOX",
                    state: "MISCONFIGURED",
                    runtime: "docker",
                    runtimeVersion: version.stdout.trim(),
                    imageIdentity: options.image,
                    controls: baseControls("CONTAINER_SANDBOX"),
                    limitations: [
                        "The pinned verification image is not present locally; VibeShield did not pull it implicitly.",
                    ],
                });
                return cachedCapability;
            }
            const info = spawnSync(docker, ["info", "--format", "{{json .}}"], {
                env: environment,
                encoding: "utf8",
                shell: false,
                windowsHide: true,
                timeout: 10_000,
                maxBuffer: 64_000,
            });
            let runtimeInfo;
            try {
                runtimeInfo = JSON.parse(info.stdout);
            }
            catch {
                runtimeInfo = undefined;
            }
            if (info.error !== undefined || info.status !== 0 || runtimeInfo === undefined) {
                cachedCapability = sandboxCapabilitySchema.parse({
                    schemaVersion: "1.0.0",
                    runner: "CONTAINER_SANDBOX",
                    state: "UNAVAILABLE",
                    runtime: "docker",
                    runtimeVersion: version.stdout.trim(),
                    imageIdentity: options.image,
                    controls: baseControls("CONTAINER_SANDBOX"),
                    limitations: [
                        "Docker daemon capability inspection failed; local execution was not attempted.",
                    ],
                });
                return cachedCapability;
            }
            const securityOptions = Array.isArray(runtimeInfo.SecurityOptions)
                ? runtimeInfo.SecurityOptions.filter((item) => typeof item === "string")
                : [];
            const missingControls = [
                ...(runtimeInfo.OSType === "linux" ? [] : ["Linux container execution"]),
                ...(runtimeInfo.MemoryLimit === true ? [] : ["memory cgroup enforcement"]),
                ...(runtimeInfo.PidsLimit === true ? [] : ["PID cgroup enforcement"]),
                ...(securityOptions.some((item) => item.includes("seccomp"))
                    ? []
                    : ["runtime-default seccomp"]),
            ];
            if (missingControls.length > 0) {
                cachedCapability = sandboxCapabilitySchema.parse({
                    schemaVersion: "1.0.0",
                    runner: "CONTAINER_SANDBOX",
                    state: "AVAILABLE_DEGRADED",
                    runtime: "docker",
                    runtimeVersion: version.stdout.trim(),
                    imageIdentity: options.image,
                    controls: {
                        ...baseControls("CONTAINER_SANDBOX"),
                        seccomp: securityOptions.some((item) => item.includes("seccomp"))
                            ? "RUNTIME_DEFAULT"
                            : "UNAVAILABLE",
                        memoryMegabytes: runtimeInfo.MemoryLimit === true ? 512 : undefined,
                        pidLimit: runtimeInfo.PidsLimit === true ? 128 : undefined,
                    },
                    limitations: [
                        `Required hardened runtime controls are unavailable: ${missingControls.join(", ")}.`,
                        "Local execution was not attempted.",
                    ],
                });
                return cachedCapability;
            }
            probeWorkspace = await mkdtemp(path.join(os.tmpdir(), "vibeshield-sandbox-probe-"));
            await chmod(probeWorkspace, 0o777).catch(() => undefined);
            probeContainerName = `vibeshield-probe-${randomUUID()}`;
            const runArguments = buildContainerArguments(options.image, probeContainerName, probeWorkspace, {
                executable: "/bin/true",
                arguments: [],
                workingDirectory: ".",
                timeoutMilliseconds: 15_000,
                networkPolicy: "DENIED",
            });
            const create = spawnSync(docker, ["create", ...runArguments.slice(2)], {
                env: environment,
                encoding: "utf8",
                shell: false,
                windowsHide: true,
                timeout: 15_000,
                maxBuffer: 64_000,
            });
            const inspection = spawnSync(docker, ["inspect", probeContainerName, "--format", "{{json .}}"], {
                env: environment,
                encoding: "utf8",
                shell: false,
                windowsHide: true,
                timeout: 10_000,
                maxBuffer: 256_000,
            });
            let inspected;
            try {
                inspected = JSON.parse(inspection.stdout);
            }
            catch {
                inspected = undefined;
            }
            const containerEnvironment = Array.isArray(inspected?.Config?.Env)
                ? inspected.Config.Env.filter((item) => typeof item === "string")
                : [];
            const capabilityDrop = Array.isArray(inspected?.HostConfig?.CapDrop)
                ? inspected.HostConfig.CapDrop
                : [];
            const securityConfiguration = Array.isArray(inspected?.HostConfig?.SecurityOpt)
                ? inspected.HostConfig.SecurityOpt
                : [];
            const mounts = Array.isArray(inspected?.Mounts) ? inspected.Mounts : [];
            const profileReceived = create.error === undefined &&
                create.status === 0 &&
                inspection.error === undefined &&
                inspection.status === 0 &&
                inspected?.Config?.User === "65534:65534" &&
                inspected.Config.WorkingDir === "/workspace" &&
                inspected.Config.Entrypoint === null &&
                containerEnvironment.includes("CI=true") &&
                containerEnvironment.includes("VIBESHIELD_VERIFICATION=1") &&
                inspected.HostConfig?.Privileged === false &&
                inspected.HostConfig.ReadonlyRootfs === true &&
                capabilityDrop.includes("ALL") &&
                securityConfiguration.includes("no-new-privileges=true") &&
                inspected.HostConfig.NetworkMode === "none" &&
                inspected.HostConfig.PidsLimit === 128 &&
                inspected.HostConfig.Memory === 536_870_912 &&
                inspected.HostConfig.MemorySwap === 536_870_912 &&
                inspected.HostConfig.NanoCpus === 1_000_000_000 &&
                mounts.length === 1 &&
                mounts.every((mount) => typeof mount === "object" &&
                    mount !== null &&
                    Reflect.get(mount, "Type") === "bind" &&
                    Reflect.get(mount, "Destination") === "/workspace" &&
                    Reflect.get(mount, "RW") === true);
            const probe = profileReceived
                ? await runBoundedProcess(docker, ["start", "--attach", probeContainerName], environment, 15_000, () => {
                    spawnSync(docker, ["kill", probeContainerName ?? ""], {
                        env: environment,
                        shell: false,
                        windowsHide: true,
                        timeout: 10_000,
                        stdio: "ignore",
                    });
                })
                : undefined;
            if (!profileReceived ||
                probe === undefined ||
                probe.spawnFailed ||
                probe.timedOut ||
                probe.outputExceeded ||
                probe.exitCode !== 0) {
                cachedCapability = sandboxCapabilitySchema.parse({
                    schemaVersion: "1.0.0",
                    runner: "CONTAINER_SANDBOX",
                    state: "AVAILABLE_DEGRADED",
                    runtime: "docker",
                    runtimeVersion: version.stdout.trim(),
                    imageIdentity: options.image,
                    controls: baseControls("CONTAINER_SANDBOX"),
                    limitations: [
                        "The daemon and image are present, but the mandatory hardened Linux launch/inspection probe failed.",
                        "The verification image must provide /bin/true for the capability probe.",
                        "Local execution was not attempted.",
                    ],
                });
                return cachedCapability;
            }
            cachedCapability = sandboxCapabilitySchema.parse({
                schemaVersion: "1.0.0",
                runner: "CONTAINER_SANDBOX",
                state: "AVAILABLE_HARDENED",
                runtime: "docker",
                runtimeVersion: version.stdout.trim(),
                imageIdentity: options.image,
                controls: baseControls("CONTAINER_SANDBOX"),
                limitations: [
                    "Container isolation reduces risk but is not claimed as a perfect security boundary.",
                    "A network-denied, non-root, read-only, resource-bounded launch probe executed successfully.",
                    "The runtime-default seccomp profile is used; host runtime enforcement remains trusted.",
                ],
            });
            return cachedCapability;
        }
        finally {
            if (probeContainerName !== undefined) {
                const environment = dockerEnvironment(configurationDirectory);
                spawnSync(docker, ["rm", "--force", probeContainerName], {
                    env: environment,
                    shell: false,
                    windowsHide: true,
                    timeout: 10_000,
                    stdio: "ignore",
                });
            }
            if (probeWorkspace !== undefined)
                await rm(probeWorkspace, { recursive: true, force: true });
            await rm(configurationDirectory, { recursive: true, force: true });
        }
    };
    return {
        kind: "CONTAINER_SANDBOX",
        capability: inspectCapability,
        async run(repositoryRoot, commandInput) {
            const command = verificationCommandSchema.parse(commandInput);
            const started = performance.now();
            const capability = await inspectCapability();
            const fingerprint = commandFingerprint(command);
            if (capability.state !== "AVAILABLE_HARDENED") {
                return verificationExecutionResultSchema.parse({
                    schemaVersion: "1.0.0",
                    runner: "CONTAINER_SANDBOX",
                    state: capability.state === "UNAVAILABLE" ? "SANDBOX_UNAVAILABLE" : "SANDBOX_MISCONFIGURED",
                    commandFingerprint: fingerprint,
                    exitCode: null,
                    durationMilliseconds: performance.now() - started,
                    stdoutBytes: 0,
                    stderrBytes: 0,
                    outputTruncated: false,
                    capability,
                    message: "Container verification did not run, and no local fallback was attempted.",
                });
            }
            if (command.networkPolicy !== "DENIED") {
                return verificationExecutionResultSchema.parse({
                    schemaVersion: "1.0.0",
                    runner: "CONTAINER_SANDBOX",
                    state: "SANDBOX_MISCONFIGURED",
                    commandFingerprint: fingerprint,
                    exitCode: null,
                    durationMilliseconds: performance.now() - started,
                    stdoutBytes: 0,
                    stderrBytes: 0,
                    outputTruncated: false,
                    capability,
                    message: "This hardened provider supports network-denied verification only.",
                });
            }
            let workspace;
            let configurationDirectory;
            let containerName;
            try {
                workspace = await copyEphemeralRepository(repositoryRoot, options.temporaryRoot);
                configurationDirectory = await mkdtemp(path.join(os.tmpdir(), "vibeshield-docker-"));
                containerName = `vibeshield-verify-${randomUUID()}`;
                const activeContainerName = containerName;
                const arguments_ = buildContainerArguments(options.image, activeContainerName, workspace, command);
                const environment = dockerEnvironment(configurationDirectory);
                const execution = await runBoundedProcess(docker, arguments_, environment, command.timeoutMilliseconds, () => {
                    spawnSync(docker, ["kill", activeContainerName], {
                        env: environment,
                        shell: false,
                        windowsHide: true,
                        timeout: 10_000,
                        stdio: "ignore",
                    });
                });
                const containerRemoved = removeAndConfirmContainer(docker, activeContainerName, environment);
                if (containerRemoved)
                    containerName = undefined;
                if (!containerRemoved) {
                    return verificationExecutionResultSchema.parse({
                        schemaVersion: "1.0.0",
                        runner: "CONTAINER_SANDBOX",
                        state: "SANDBOX_MISCONFIGURED",
                        commandFingerprint: fingerprint,
                        exitCode: execution.exitCode,
                        durationMilliseconds: performance.now() - started,
                        stdoutBytes: execution.stdoutBytes,
                        stderrBytes: execution.stderrBytes,
                        outputTruncated: execution.outputExceeded,
                        capability,
                        message: "Container workload cleanup could not be confirmed; no success or timeout result was reported.",
                    });
                }
                const state = execution.timedOut
                    ? "TIMED_OUT"
                    : execution.outputExceeded
                        ? "OUTPUT_LIMIT_EXCEEDED"
                        : execution.spawnFailed
                            ? "SANDBOX_UNAVAILABLE"
                            : execution.exitCode === 0
                                ? "SUCCEEDED"
                                : "COMMAND_FAILED";
                return verificationExecutionResultSchema.parse({
                    schemaVersion: "1.0.0",
                    runner: "CONTAINER_SANDBOX",
                    state,
                    commandFingerprint: fingerprint,
                    exitCode: execution.exitCode,
                    durationMilliseconds: performance.now() - started,
                    stdoutBytes: execution.stdoutBytes,
                    stderrBytes: execution.stderrBytes,
                    outputTruncated: execution.outputExceeded,
                    capability,
                    message: state === "SUCCEEDED"
                        ? "Command passed in the ephemeral network-denied container; output was discarded."
                        : "Container command failed within an enforced bound; output was discarded.",
                });
            }
            catch {
                return verificationExecutionResultSchema.parse({
                    schemaVersion: "1.0.0",
                    runner: "CONTAINER_SANDBOX",
                    state: "WORKSPACE_FAILED",
                    commandFingerprint: fingerprint,
                    exitCode: null,
                    durationMilliseconds: performance.now() - started,
                    stdoutBytes: 0,
                    stderrBytes: 0,
                    outputTruncated: false,
                    capability,
                    message: "Ephemeral verification workspace preparation failed safely.",
                });
            }
            finally {
                if (containerName !== undefined && configurationDirectory !== undefined) {
                    removeAndConfirmContainer(docker, containerName, dockerEnvironment(configurationDirectory));
                }
                if (workspace !== undefined)
                    await rm(workspace, { recursive: true, force: true });
                if (configurationDirectory !== undefined)
                    await rm(configurationDirectory, { recursive: true, force: true });
            }
        },
    };
}
//# sourceMappingURL=runner.js.map