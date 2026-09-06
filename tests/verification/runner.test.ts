import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runRemediation } from "../../src/remediation/fix.js";
import {
  buildContainerArguments,
  createContainerSandboxRunner,
  createLocalExplicitRunner,
  createNoExecutionRunner,
  hardenedContainerProfileFailures,
} from "../../src/verification/runner.js";

const temporaryDirectories: string[] = [];

async function temporary(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("verification runners", () => {
  it("constructs a hardened non-shell container invocation and rejects workdir escapes", () => {
    const command = {
      executable: "node",
      arguments: ["--version"],
      workingDirectory: ".",
      timeoutMilliseconds: 5000,
      networkPolicy: "DENIED" as const,
    };
    const arguments_ = buildContainerArguments(
      `sha256:${"c".repeat(64)}`,
      "cydetix-test",
      "C:\\bounded workspace",
      command,
    );
    expect(arguments_).toEqual(
      expect.arrayContaining([
        "--entrypoint=",
        "--network",
        "none",
        "--read-only",
        "/tmp:rw,noexec,nosuid,size=64m",
        "/run:rw,noexec,nosuid,size=16m",
        "--cap-drop",
        "ALL",
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
        "CI=true",
        "CYDETIX_VERIFICATION=1",
      ]),
    );
    expect(arguments_.at(-2)).toBe("node");
    expect(arguments_.at(-1)).toBe("--version");
    expect(() =>
      buildContainerArguments(`sha256:${"c".repeat(64)}`, "test", "C:\\root", {
        ...command,
        workingDirectory: "../workspace-escape",
      }),
    ).toThrow(/escapes workspace/u);
  });

  it.each([
    { entrypoint: null, securityOption: "no-new-privileges=true" },
    { entrypoint: [], securityOption: "no-new-privileges" },
  ])("accepts equivalent hardened Docker inspect forms: $securityOption", (representation) => {
    expect(
      hardenedContainerProfileFailures({
        Config: {
          User: "65534:65534",
          Env: ["CI=true", "CYDETIX_VERIFICATION=1"],
          WorkingDir: "/workspace",
          Entrypoint: representation.entrypoint,
        },
        HostConfig: {
          Privileged: false,
          ReadonlyRootfs: true,
          CapDrop: ["ALL"],
          SecurityOpt: [representation.securityOption],
          NetworkMode: "none",
          PidsLimit: 128,
          Memory: 536_870_912,
          MemorySwap: 536_870_912,
          NanoCpus: 1_000_000_000,
        },
        Mounts: [{ Type: "bind", Destination: "/workspace", RW: true }],
      }),
    ).toEqual([]);
  });

  it("rejects absent or non-equivalent hardened Docker controls", () => {
    const failures = hardenedContainerProfileFailures({
      Config: {
        User: "65534:65534",
        Env: ["CI=true", "CYDETIX_VERIFICATION=1"],
        WorkingDir: "/workspace",
        Entrypoint: ["/repository-controlled-entrypoint"],
      },
      HostConfig: {
        Privileged: false,
        ReadonlyRootfs: true,
        CapDrop: ["ALL"],
        SecurityOpt: [],
        NetworkMode: "none",
        PidsLimit: "128",
        Memory: 536_870_912,
        MemorySwap: 536_870_912,
        NanoCpus: 1_000_000_000,
      },
      Mounts: [{ Type: "bind", Destination: "/workspace", RW: false }],
    });
    expect(failures).toEqual([
      "explicit empty entrypoint",
      "no-new-privileges",
      "PID limit",
      "ephemeral workspace mount",
    ]);
  });

  it("keeps commands inert under NO_EXECUTION", async () => {
    const root = await temporary("cydetix-no-exec-");
    const marker = path.join(root, "executed.txt");
    const runner = createNoExecutionRunner();
    const result = await runner.run(root, {
      executable: process.execPath,
      arguments: ["-e", `require('fs').writeFileSync(${JSON.stringify(marker)}, 'bad')`],
      workingDirectory: ".",
      timeoutMilliseconds: 1000,
      networkPolicy: "DENIED",
    });
    expect(result.state).toBe("NOT_RUN");
    await expect(readFile(marker)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("sanitizes the environment for explicitly selected local execution", async () => {
    const root = await temporary("cydetix-local-exec-");
    process.env.CYDETIX_SYNTHETIC_HOST_SECRET = "must-not-cross";
    try {
      const result = await createLocalExplicitRunner().run(root, {
        executable: process.execPath,
        arguments: [
          "-e",
          "process.exit(process.env.CYDETIX_SYNTHETIC_HOST_SECRET === undefined ? 0 : 19)",
        ],
        workingDirectory: ".",
        timeoutMilliseconds: 5000,
        networkPolicy: "DENIED",
      });
      expect(result.state).toBe("SUCCEEDED");
      expect(result.capability.state).toBe("AVAILABLE_DEGRADED");
      expect(result.capability.controls.network).toBe("NOT_ISOLATED");
    } finally {
      delete process.env.CYDETIX_SYNTHETIC_HOST_SECRET;
    }
  });

  it("rejects mutable images and never falls back when Docker is unavailable", async () => {
    const mutable = createContainerSandboxRunner({ image: "node:22-alpine" });
    expect((await mutable.capability()).state).toBe("MISCONFIGURED");

    const root = await temporary("cydetix-container-unavailable-");
    const marker = path.join(root, "executed.txt");
    const unavailable = createContainerSandboxRunner({
      image: `sha256:${"a".repeat(64)}`,
      dockerExecutable: path.join(root, "missing-docker"),
    });
    const result = await unavailable.run(root, {
      executable: process.execPath,
      arguments: ["-e", `require('fs').writeFileSync(${JSON.stringify(marker)}, 'bad')`],
      workingDirectory: ".",
      timeoutMilliseconds: 1000,
      networkPolicy: "DENIED",
    });
    expect(result.state).toBe("SANDBOX_UNAVAILABLE");
    await expect(readFile(marker)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("restores a SAFE patch when the required sandbox is unavailable", async () => {
    const root = await temporary("cydetix-sandbox-rollback-");
    const source =
      'from flask import Flask\napp = Flask(__name__)\napp.config["SESSION_COOKIE_HTTPONLY"] = False\n';
    await writeFile(path.join(root, "app.py"), source, "utf8");
    const report = await runRemediation({
      path: root,
      applySafe: true,
      verificationCommands: [{ executable: process.execPath, arguments: ["--version"] }],
      verificationRunner: createContainerSandboxRunner({
        image: `sha256:${"b".repeat(64)}`,
        dockerExecutable: path.join(root, "missing-docker"),
      }),
    });
    expect(report.transactions[0]?.finalState).toBe("SANDBOX_UNAVAILABLE");
    expect(report.transactions[0]?.verificationResults).toContainEqual(
      expect.objectContaining({ stage: "TRUSTED_COMMAND", status: "UNAVAILABLE" }),
    );
    expect(await readFile(path.join(root, "app.py"), "utf8")).toBe(source);
  });
});
