import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { scanRepository } from "../../src/core/engine.js";
import { runRemediation } from "../../src/remediation/fix.js";
import {
  createContainerSandboxRunner,
  type VerificationRunner,
} from "../../src/verification/runner.js";

const sandboxImage = process.env.VIBESHIELD_SANDBOX_IMAGE;

function hostPathCandidates(hostPath: string): string[] {
  const normalized = hostPath.replaceAll("\\", "/");
  const drivePath = /^([a-zA-Z]):\/(.*)$/u.exec(normalized);
  if (drivePath === null) return [normalized];
  const drive = drivePath[1]?.toLowerCase();
  const rest = drivePath[2];
  return [
    normalized,
    `/mnt/${drive}/${rest}`,
    `/host_mnt/${drive}/${rest}`,
    `/run/desktop/mnt/host/${drive}/${rest}`,
  ];
}

function sha256(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

describe.skipIf(sandboxImage === undefined)("hardened container sandbox", () => {
  let root = "";
  let runner: VerificationRunner;

  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "invariantsec-container-proof-"));
    runner = createContainerSandboxRunner({ image: sandboxImage ?? "" });
    const capability = await runner.capability();
    expect(capability.state).toBe("AVAILABLE_HARDENED");
    expect(capability.controls.environment).toBe("SANITIZED");
  }, 60_000);

  afterAll(async () => {
    if (root !== "") await rm(root, { recursive: true, force: true });
  });

  it("sanitizes host environment, isolates real host canaries, and uses an ephemeral workspace", async () => {
    const marker = path.join(root, "container-marker.txt");
    const canaryValue = "synthetic-phase6b-host-file-canary";
    const temporaryCanary = path.join(os.tmpdir(), `invariantsec-host-${randomUUID()}.txt`);
    const homeCanary = path.join(os.homedir(), `.invariantsec-host-${randomUUID()}.txt`);
    const canaryEnvironment = {
      INVARIANTSEC_TEST_AWS_SECRET: "synthetic-aws-secret-phase6b",
      INVARIANTSEC_TEST_GITHUB_TOKEN: "synthetic-github-token-phase6b",
      INVARIANTSEC_TEST_DATABASE_PASSWORD: "synthetic-database-password-phase6b",
    };
    await Promise.all([
      writeFile(temporaryCanary, canaryValue, "utf8"),
      writeFile(homeCanary, canaryValue, "utf8"),
    ]);
    Object.assign(process.env, canaryEnvironment);
    try {
      const result = await runner.run(root, {
        executable: "node",
        arguments: [
          "-e",
          [
            "const fs=require('node:fs')",
            `const forbiddenEnvironment=${JSON.stringify(Object.keys(canaryEnvironment))}`,
            "if(forbiddenEnvironment.some(name=>process.env[name]!==undefined))process.exit(21)",
            "if(process.env.CI!=='true'||process.env.VIBESHIELD_VERIFICATION!=='1')process.exit(22)",
            `const candidates=${JSON.stringify([
              ...hostPathCandidates(temporaryCanary),
              ...hostPathCandidates(homeCanary),
              `/workspace/../${path.basename(homeCanary)}`,
            ])}`,
            `if(candidates.some(candidate=>fs.existsSync(candidate)&&fs.readFileSync(candidate,'utf8')===${JSON.stringify(canaryValue)}))process.exit(23)`,
            "if(['/var/run/docker.sock','/run/docker.sock','/tmp/ssh-agent.sock'].some(candidate=>fs.existsSync(candidate)))process.exit(24)",
            "fs.writeFileSync('/workspace/container-marker.txt','sandbox-only')",
          ].join(";"),
        ],
        workingDirectory: ".",
        timeoutMilliseconds: 15_000,
        networkPolicy: "DENIED",
      });
      expect(result.state).toBe("SUCCEEDED");
      await expect(readFile(marker, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      delete process.env.INVARIANTSEC_TEST_AWS_SECRET;
      delete process.env.INVARIANTSEC_TEST_GITHUB_TOKEN;
      delete process.env.INVARIANTSEC_TEST_DATABASE_PASSWORD;
      await Promise.all([rm(temporaryCanary, { force: true }), rm(homeCanary, { force: true })]);
    }
  });

  it("denies DNS resolution, TCP connections, and HTTP/HTTPS requests", async () => {
    const result = await runner.run(root, {
      executable: "node",
      arguments: [
        "-e",
        [
          "const dns=require('node:dns'),net=require('node:net'),http=require('node:http'),https=require('node:https')",
          "const timeout=(reject)=>setTimeout(()=>reject(new Error('network-attempt-timeout')),10000)",
          "const dnsAttempt=new Promise((resolve,reject)=>{const timer=timeout(reject);dns.lookup('example.com',(error,address)=>{clearTimeout(timer);resolve({kind:'dns',denied:Boolean(error),address})})})",
          "const tcpAttempt=new Promise((resolve)=>{const socket=net.connect({host:'203.0.113.1',port:80});const done=(denied)=>{socket.destroy();resolve({kind:'tcp',denied})};socket.setTimeout(8000,()=>done(true));socket.once('error',()=>done(true));socket.once('connect',()=>done(false))})",
          "const requestAttempt=(kind,module,url)=>new Promise((resolve)=>{const request=module.get(url,response=>{response.resume();resolve({kind,denied:false})});request.setTimeout(10000,()=>request.destroy(new Error('network-attempt-timeout')));request.once('error',()=>resolve({kind,denied:true}))})",
          "Promise.all([dnsAttempt,tcpAttempt,requestAttempt('http',http,'http://example.com'),requestAttempt('https',https,'https://example.com')]).then(results=>process.exit(results.length===4&&results.every(item=>item.denied)?0:31)).catch(()=>process.exit(0))",
        ].join(";"),
      ],
      workingDirectory: ".",
      timeoutMilliseconds: 18_000,
      networkPolicy: "DENIED",
    });
    expect(result.state).toBe("SUCCEEDED");
  }, 30_000);

  it("receives non-root, privilege, socket, mount, rootfs, and cgroup controls", async () => {
    const result = await runner.run(root, {
      executable: "node",
      arguments: [
        "-e",
        [
          "const fs=require('node:fs')",
          "if(process.getuid()!==65534||process.getgid()!==65534)process.exit(41)",
          "const status=fs.readFileSync('/proc/self/status','utf8')",
          "for(const field of ['CapInh','CapPrm','CapEff','CapBnd','CapAmb'])if(!new RegExp('^'+field+':\\\\s+0+$','m').test(status))process.exit(42)",
          "if(!/^NoNewPrivs:\\s+1$/m.test(status)||!/^Seccomp:\\s+2$/m.test(status))process.exit(43)",
          "try{fs.writeFileSync('/invariantsec-rootfs-canary','bad');process.exit(44)}catch(error){if(!['EROFS','EACCES'].includes(error.code))process.exit(45)}",
          "if(process.env.DOCKER_HOST!==undefined||process.env.SSH_AUTH_SOCK!==undefined)process.exit(46)",
          "if(['/var/run/docker.sock','/run/docker.sock'].some(candidate=>fs.existsSync(candidate)))process.exit(47)",
          "const mounts=fs.readFileSync('/proc/self/mountinfo','utf8')",
          "if(['docker.sock','ssh-agent','host_mnt','/run/desktop/mnt/host'].some(needle=>mounts.includes(needle)))process.exit(48)",
          "if(fs.readFileSync('/sys/fs/cgroup/memory.max','utf8').trim()!=='536870912')process.exit(49)",
          "if(fs.readFileSync('/sys/fs/cgroup/memory.swap.max','utf8').trim()!=='0')process.exit(50)",
          "if(fs.readFileSync('/sys/fs/cgroup/pids.max','utf8').trim()!=='128')process.exit(51)",
          "const [quota,period]=fs.readFileSync('/sys/fs/cgroup/cpu.max','utf8').trim().split(/\\s+/).map(Number)",
          "if(!Number.isFinite(quota)||!Number.isFinite(period)||quota/period>1)process.exit(52)",
        ].join(";"),
      ],
      workingDirectory: ".",
      timeoutMilliseconds: 15_000,
      networkPolicy: "DENIED",
    });
    expect(result.exitCode).toBe(0);
    expect(result.state).toBe("SUCCEEDED");
  });

  it("terminates a timed-out process tree and removes the container", async () => {
    const result = await runner.run(root, {
      executable: "node",
      arguments: [
        "-e",
        "require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)']);setInterval(()=>{},1000)",
      ],
      workingDirectory: ".",
      timeoutMilliseconds: 1000,
      networkPolicy: "DENIED",
    });
    expect(result.state).toBe("TIMED_OUT");
    const remaining = spawnSync(
      "docker",
      ["ps", "-a", "--filter", "name=vibeshield-verify-", "--format", "{{.Names}}"],
      { encoding: "utf8", shell: false, windowsHide: true, timeout: 10_000 },
    );
    expect(remaining.status).toBe(0);
    expect(remaining.stdout.trim()).toBe("");
  });

  it("enforces the aggregate captured-output bound", async () => {
    const result = await runner.run(root, {
      executable: "node",
      arguments: ["-e", "process.stdout.write('x'.repeat(3000000))"],
      workingDirectory: ".",
      timeoutMilliseconds: 15_000,
      networkPolicy: "DENIED",
    });
    expect(result.state).toBe("OUTPUT_LIMIT_EXCEEDED");
    expect(result.outputTruncated).toBe(true);
    expect(result.stdoutBytes + result.stderrBytes).toBeLessThanOrEqual(2_000_000);
  });

  it("enforces the container PID bound", async () => {
    const result = await runner.run(root, {
      executable: "node",
      arguments: [
        "-e",
        [
          "const {spawn}=require('node:child_process')",
          "let bounded=false",
          "for(let i=0;i<180;i++){const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)']);child.on('error',()=>{bounded=true})}",
          "setTimeout(()=>process.exit(bounded?0:61),2000)",
        ].join(";"),
      ],
      workingDirectory: ".",
      timeoutMilliseconds: 15_000,
      networkPolicy: "DENIED",
    });
    expect(result.state).toBe("SUCCEEDED");
  });

  it("enforces memory and temporary-filesystem exhaustion bounds", async () => {
    const memory = await runner.run(root, {
      executable: "node",
      arguments: [
        "-e",
        "const n=700*1024*1024,x=Buffer.allocUnsafe(n);for(let i=0;i<n;i+=4096)x[i]=(i>>>12)&255;setTimeout(()=>{},2000)",
      ],
      workingDirectory: ".",
      timeoutMilliseconds: 15_000,
      networkPolicy: "DENIED",
    });
    expect(memory.state).toBe("COMMAND_FAILED");
    expect(memory.exitCode).toBe(137);

    const disk = await runner.run(root, {
      executable: "node",
      arguments: [
        "-e",
        "const fs=require('node:fs');try{fs.writeFileSync('/tmp/fill',Buffer.alloc(80*1024*1024,65));process.exit(71)}catch(error){process.exit(error.code==='ENOSPC'?0:72)}",
      ],
      workingDirectory: ".",
      timeoutMilliseconds: 15_000,
      networkPolicy: "DENIED",
    });
    expect(disk.state).toBe("SUCCEEDED");
  }, 60_000);

  it("cleans isolated workspaces after success, failure, and timeout", async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "invariantsec-workspace-parent-"));
    const source = await mkdtemp(path.join(os.tmpdir(), "invariantsec-workspace-source-"));
    await writeFile(path.join(source, "baseline.txt"), "original\n", "utf8");
    const isolated = createContainerSandboxRunner({
      image: sandboxImage ?? "",
      temporaryRoot,
    });
    try {
      const commands = [
        "require('fs').writeFileSync('success.txt','sandbox');process.exit(0)",
        "require('fs').writeFileSync('failure.txt','sandbox');process.exit(7)",
        "require('fs').writeFileSync('timeout.txt','sandbox');setInterval(()=>{},1000)",
      ];
      const expectedStates = ["SUCCEEDED", "COMMAND_FAILED", "TIMED_OUT"];
      for (const [index, command] of commands.entries()) {
        const result = await isolated.run(source, {
          executable: "node",
          arguments: ["-e", command],
          workingDirectory: ".",
          timeoutMilliseconds: index === 2 ? 1000 : 15_000,
          networkPolicy: "DENIED",
        });
        expect(result.state).toBe(expectedStates[index]);
        expect(await readdir(temporaryRoot)).toEqual([]);
      }
      expect(await readdir(source)).toEqual(["baseline.txt"]);
      expect(await readFile(path.join(source, "baseline.txt"), "utf8")).toBe("original\n");
    } finally {
      await Promise.all([
        rm(temporaryRoot, { recursive: true, force: true }),
        rm(source, { recursive: true, force: true }),
      ]);
    }
  });

  it("does not silently fall back after a successful sandbox run", async () => {
    const available = await runner.run(root, {
      executable: "node",
      arguments: ["-e", "process.exit(0)"],
      workingDirectory: ".",
      timeoutMilliseconds: 15_000,
      networkPolicy: "DENIED",
    });
    expect(available.state).toBe("SUCCEEDED");

    const marker = path.join(root, "local-fallback-marker.txt");
    const unavailable = createContainerSandboxRunner({
      image: sandboxImage ?? "",
      dockerExecutable: path.join(root, "missing-docker"),
    });
    const failedClosed = await unavailable.run(root, {
      executable: "node",
      arguments: ["-e", "require('node:fs').writeFileSync('local-fallback-marker.txt','bad')"],
      workingDirectory: ".",
      timeoutMilliseconds: 1000,
      networkPolicy: "DENIED",
    });
    expect(failedClosed.state).toBe("SANDBOX_UNAVAILABLE");
    await expect(readFile(marker, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("clears an image entrypoint that would intercept the authorized command", async () => {
    const identity = randomUUID();
    const seedName = `invariantsec-entrypoint-seed-${identity}`;
    const imageName = `invariantsec-entrypoint-test:${identity}`;
    const runDocker = (arguments_: string[]) =>
      spawnSync("docker", arguments_, {
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: 30_000,
        maxBuffer: 1_000_000,
      });
    try {
      const seed = runDocker(["create", "--name", seedName, sandboxImage ?? "", "/bin/true"]);
      expect(seed.status).toBe(0);
      const committed = runDocker([
        "commit",
        "--change",
        'ENTRYPOINT ["node","-e","process.exit(0)"]',
        seedName,
        imageName,
      ]);
      expect(committed.status).toBe(0);
      const image = runDocker(["image", "inspect", imageName, "--format", "{{.Id}}"]);
      expect(image.status).toBe(0);
      const entrypointImage = createContainerSandboxRunner({ image: image.stdout.trim() });
      expect((await entrypointImage.capability()).state).toBe("AVAILABLE_HARDENED");
      const result = await entrypointImage.run(root, {
        executable: "node",
        arguments: ["-e", "process.exit(83)"],
        workingDirectory: ".",
        timeoutMilliseconds: 15_000,
        networkPolicy: "DENIED",
      });
      expect(result.state).toBe("COMMAND_FAILED");
      expect(result.exitCode).toBe(83);
    } finally {
      runDocker(["rm", "--force", seedName]);
      runDocker(["image", "rm", "--force", imageName]);
    }
  });

  it("completes a sandbox-verified SAFE remediation and remains idempotent", async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), "invariantsec-container-fix-"));
    const target = path.join(temporary, "repo");
    await cp(path.resolve("fixtures", "autofix", "vulnerable"), target, { recursive: true });
    try {
      const targetFile = path.join(target, "app.py");
      const before = await scanRepository({ path: target });
      const finding = before.findings.find(
        (candidate) => candidate.ruleId === "AS-SESSION-001" && candidate.autofix === "SAFE",
      );
      if (finding === undefined) throw new Error("Expected a SAFE fixture finding.");
      const originalHash = sha256(await readFile(targetFile));
      const dryRun = await runRemediation({
        path: target,
        finding: finding.fingerprint,
        dryRun: true,
        applySafe: true,
      });
      expect(dryRun.transactions).toEqual([]);
      expect(sha256(await readFile(targetFile))).toBe(originalHash);

      const applied = await runRemediation({
        path: target,
        finding: finding.fingerprint,
        applySafe: true,
        verificationRunner: runner,
        verificationCommands: [
          {
            executable: "node",
            arguments: [
              "-e",
              "const source=require('node:fs').readFileSync('app.py','utf8');process.exit(source.includes('= True')?0:81)",
            ],
          },
        ],
      });
      expect(applied.transactions[0]?.finalState).toBe("APPLIED_VERIFIED");
      expect(applied.transactions[0]?.findingStateTransitions).toContainEqual(
        expect.objectContaining({
          invariant: "SESSION_COOKIE_HTTPONLY",
          before: "PROVEN_INSECURE",
          after: "PROVEN_SECURE",
          result: "RESOLVED_VERIFIED",
        }),
      );
      expect(sha256(await readFile(targetFile))).not.toBe(originalHash);

      const secureHash = sha256(await readFile(targetFile));
      const second = await runRemediation({
        path: target,
        applySafe: true,
        nonInteractive: true,
        verificationRunner: runner,
      });
      expect(second.transactions).toEqual([]);
      expect(second.findingsConsidered).toBe(0);
      expect(sha256(await readFile(targetFile))).toBe(secureHash);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it("rolls back a sandbox verification failure without touching user changes", async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), "invariantsec-container-rollback-"));
    const target = path.join(temporary, "repo");
    await cp(path.resolve("fixtures", "autofix", "vulnerable"), target, { recursive: true });
    const sourcePath = path.join(target, "app.py");
    const notesPath = path.join(target, "notes.txt");
    await writeFile(notesPath, "user change\n", "utf8");
    const sourceHash = sha256(await readFile(sourcePath));
    const notesHash = sha256(await readFile(notesPath));
    try {
      const report = await runRemediation({
        path: target,
        applySafe: true,
        verificationRunner: runner,
        verificationCommands: [{ executable: "node", arguments: ["-e", "process.exit(9)"] }],
      });
      expect(report.transactions[0]?.finalState).toBe("ROLLBACK_SUCCEEDED");
      expect(report.transactions[0]?.finalState).not.toBe("APPLIED_VERIFIED");
      expect(report.transactions[0]?.verificationResults).toContainEqual(
        expect.objectContaining({ stage: "TRUSTED_COMMAND", status: "FAILED" }),
      );
      expect(sha256(await readFile(sourcePath))).toBe(sourceHash);
      expect(sha256(await readFile(notesPath))).toBe(notesHash);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it("does not retain secret-shaped or terminal-control sandbox output", async () => {
    const secret = "ghp_INVARIANTSEC_PHASE6B_SYNTHETIC_1234567890";
    const control = "\u001b[31m\u001b]0;owned\u0007\rreplace\btext";
    const scripts = [
      `process.stdout.write(${JSON.stringify(secret)});process.stderr.write(${JSON.stringify(secret)});process.exit(9)`,
      `process.stderr.write(JSON.stringify({error:${JSON.stringify(secret)}}));throw new Error(${JSON.stringify(secret)})`,
      `process.stdout.write(${JSON.stringify(`${secret}${control}`)});setInterval(()=>{},1000)`,
      `process.stdout.write(${JSON.stringify(secret)}+'x'.repeat(3000000))`,
    ];
    const expectedStates = [
      "COMMAND_FAILED",
      "COMMAND_FAILED",
      "TIMED_OUT",
      "OUTPUT_LIMIT_EXCEEDED",
    ];
    for (const [index, script] of scripts.entries()) {
      const result = await runner.run(root, {
        executable: "node",
        arguments: ["-e", script],
        workingDirectory: ".",
        timeoutMilliseconds: index === 2 ? 1000 : 15_000,
        networkPolicy: "DENIED",
      });
      expect(result.state).toBe(expectedStates[index]);
      const retained = JSON.stringify(result);
      expect(retained).not.toContain(secret);
      expect(retained).not.toContain("\u001b");
      expect(retained).not.toContain("\u0007");
      expect(retained).not.toContain("\r");
      expect(retained).not.toContain("\b");
    }
  }, 40_000);
});
