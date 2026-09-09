import { spawnSync } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const npmCli = process.env.npm_execpath;
if (npmCli === undefined) throw new Error("npm_execpath is required; invoke through npm run.");
const root = path.resolve(".");
const releaseTemporaryRoot = path.resolve(".cydetix", "release-tests");
await mkdir(releaseTemporaryRoot, { recursive: true });
const temporary = await mkdtemp(path.join(releaseTemporaryRoot, "packed-install-"));
const integrationHome = path.join(temporary, "home");
await mkdir(integrationHome);
const cache = path.resolve(".npm-cache");
const evidenceDirectory = path.resolve(".cydetix", "evidence");
const evidencePath = path.join(evidenceDirectory, "packed-install.json");
await mkdir(evidenceDirectory, { recursive: true });
await rm(evidencePath, { force: true });
function run(
  executable,
  arguments_,
  cwd,
  timeout = 120_000,
  acceptedStatuses = [0],
  input,
  environment = {},
) {
  const result = spawnSync(executable, arguments_, {
    cwd,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout,
    maxBuffer: 5_000_000,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      PATHEXT: process.env.PATHEXT,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      npm_config_cache: cache,
      NO_UPDATE_NOTIFIER: "1",
      CYDETIX_SETUP_HOME: integrationHome,
      ...environment,
    },
    ...(input === undefined ? {} : { input }),
  });
  if (result.error !== undefined || !acceptedStatuses.includes(result.status)) {
    const diagnostic = String(result.stderr ?? "")
      .replaceAll(root, "<workspace>")
      .replaceAll(temporary, "<temporary>")
      .trim()
      .slice(-1_000);
    const stdoutDiagnostic = String(result.stdout ?? "")
      .replaceAll(root, "<workspace>")
      .replaceAll(temporary, "<temporary>")
      .trim()
      .slice(-1_500);
    throw new Error(
      `Packed installation command failed at ${path.basename(executable)} ${arguments_[1] ?? arguments_[0] ?? ""}; exit=${String(result.status)}; error=${String(result.error?.code ?? "none")}; stderr=${diagnostic || "none"}; stdout=${stdoutDiagnostic || "none"}.`,
    );
  }
  return result.stdout;
}
try {
  const packageDirectory = path.join(temporary, "package");
  const consumer = path.join(temporary, "consumer");
  const npxConsumer = path.join(temporary, "npx-consumer");
  const npxFixture = path.join(npxConsumer, "fixture");
  const globalPrefix = path.join(temporary, "global-prefix");
  const olderGlobalBin = path.join(temporary, "older-global-bin");
  const globalFixFixture = path.join(temporary, "global-fix-fixture");
  const fixture = path.join(consumer, "fixture");
  await mkdir(packageDirectory);
  await mkdir(fixture, { recursive: true });
  await mkdir(npxFixture, { recursive: true });
  await mkdir(globalFixFixture, { recursive: true });
  await mkdir(olderGlobalBin);
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const suppliedTarball = process.env.CYDETIX_PACKAGE_TARBALL;
  let tarball;
  let packedVersion;
  if (suppliedTarball === undefined) {
    const packOutput = run(
      process.execPath,
      [npmCli, "pack", "--json", "--ignore-scripts", "--pack-destination", packageDirectory],
      root,
    );
    const packed = JSON.parse(packOutput)[0];
    if (packed?.filename === undefined) throw new Error("npm pack returned no artifact name.");
    packedVersion = packed.version;
    tarball = path.join(packageDirectory, packed.filename);
  } else {
    tarball = path.join(packageDirectory, path.basename(suppliedTarball));
    await copyFile(path.resolve(suppliedTarball), tarball);
  }
  await writeFile(
    path.join(consumer, "package.json"),
    `${JSON.stringify({ name: "cydetix-packed-smoke", private: true }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(fixture, "app.py"),
    'app.config["SESSION_COOKIE_HTTPONLY"] = False\n',
    "utf8",
  );
  await writeFile(
    path.join(npxFixture, "app.py"),
    'app.config["SESSION_COOKIE_HTTPONLY"] = False\n',
    "utf8",
  );
  await writeFile(
    path.join(globalFixFixture, "app.py"),
    'app.config["SESSION_COOKIE_HTTPONLY"] = False\n',
    "utf8",
  );
  run(
    process.execPath,
    [npmCli, "install", "--ignore-scripts", "--prefer-offline", "--no-audit", "--no-fund", tarball],
    consumer,
    300_000,
  );
  run(
    process.execPath,
    [
      npmCli,
      "install",
      "--global",
      "--prefix",
      globalPrefix,
      "--ignore-scripts",
      "--prefer-offline",
      "--no-audit",
      "--no-fund",
      tarball,
    ],
    temporary,
    300_000,
  );
  const installedRoot = path.join(consumer, "node_modules", ...packageJson.name.split("/"));
  const cli = path.join(installedRoot, "dist", "cli", "main.js");
  const installedPackageJson = JSON.parse(
    await readFile(path.join(installedRoot, "package.json"), "utf8"),
  );
  const installedProduct = (
    await import(pathToFileURL(path.join(installedRoot, "dist", "core", "brand.js")).href)
  ).PRODUCT;
  const version = run(process.execPath, [cli, "--version"], consumer).trim();
  if (
    version !== packageJson.version ||
    installedPackageJson.version !== packageJson.version ||
    installedProduct.version !== packageJson.version ||
    (packedVersion !== undefined && packedVersion !== packageJson.version)
  )
    throw new Error("Package, PRODUCT, tarball, and packed CLI versions must match exactly.");
  const binaryName = "cydetix";
  if (packageJson.bin?.[binaryName] !== "dist/cli/main.js")
    throw new Error("Packed package has no correctly mapped cydetix binary.");
  const globalInstalledRoot = path.join(
    globalPrefix,
    ...(process.platform === "win32" ? ["node_modules"] : ["lib", "node_modules"]),
    ...packageJson.name.split("/"),
  );
  const globalCli = path.join(globalInstalledRoot, "dist", "cli", "main.js");
  if ((await stat(globalCli)).isFile() !== true) throw new Error("Global CLI package is missing.");
  const globalLauncher = path.join(
    globalPrefix,
    ...(process.platform === "win32" ? [] : ["bin"]),
    process.platform === "win32" ? `${binaryName}.cmd` : binaryName,
  );
  if ((await stat(globalLauncher)).isFile() !== true)
    throw new Error("Global CLI launcher is missing.");
  const runGlobal = (arguments_, cwd, acceptedStatuses = [0]) =>
    process.platform === "win32"
      ? run(
          process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe",
          ["/d", "/s", "/c", globalLauncher, ...arguments_],
          cwd,
          120_000,
          acceptedStatuses,
        )
      : run(globalLauncher, arguments_, cwd, 120_000, acceptedStatuses);
  const globalVersion = runGlobal(["--version"], npxConsumer).trim();
  if (globalVersion !== packageJson.version) throw new Error("Global CLI version mismatch.");
  // A release-preview validator is itself a captured subprocess on Windows. Keep that
  // nested launcher check independent of cmd.exe's ambient-directory propagation;
  // the packed entrypoint's zero-argument human mode is exercised below, and the
  // source-pack path still exercises the installed global launcher's zero-argument mode.
  const globalDefault =
    suppliedTarball === undefined
      ? runGlobal([], fixture)
      : runGlobal(["scan", fixture, "--format", "text", "--non-interactive"], npxConsumer);
  if (
    suppliedTarball === undefined
      ? !globalDefault.startsWith("Cydetix\n\nScanning ")
      : !globalDefault.startsWith(`cydetix ${packageJson.version}\nTarget: `)
  )
    throw new Error("Global cydetix scan failed.");
  if (!runGlobal(["--help"], fixture).includes("Usage: cydetix"))
    throw new Error("Global cydetix help failed.");
  const globalSetup = runGlobal(
    ["setup", "--agent", "generic-mcp", "--yes", "--project", fixture],
    npxConsumer,
  );
  if (!globalSetup.includes("Now ask your AI")) throw new Error("Global cydetix setup failed.");
  const globalSetupConfig = JSON.parse(
    await readFile(path.join(fixture, ".cydetix", "mcp.json"), "utf8"),
  ).mcpServers?.cydetix;
  if (
    globalSetupConfig?.command !== (await realpath(process.execPath)) ||
    globalSetupConfig.args?.[0] !== (await realpath(globalCli)) ||
    !globalSetupConfig.args?.includes("--project-root") ||
    !globalSetupConfig.args?.includes(await realpath(fixture)) ||
    !globalSetupConfig.args?.includes("--require-version") ||
    !globalSetupConfig.args?.includes(packageJson.version) ||
    /\bn(?:pm|px)\b|registry\./iu.test(JSON.stringify(globalSetupConfig))
  )
    throw new Error("Global setup did not generate an exact direct persistent MCP runtime.");
  const globalStatus = runGlobal(
    ["setup", "--agent", "generic-mcp", "--status", "--project", fixture],
    npxConsumer,
  );
  if (!globalStatus.includes("Generic MCP — configured"))
    throw new Error("Global cydetix setup status failed.");
  const globalVerify = runGlobal(
    ["setup", "--agent", "generic-mcp", "--verify", "--project", fixture],
    npxConsumer,
  );
  if (!globalVerify.includes("Verification: PASS"))
    throw new Error("Global cydetix setup verification failed.");
  const globalFix = JSON.parse(
    runGlobal(["fix", "--non-interactive", "--format", "json"], globalFixFixture, [5]),
  );
  if (globalFix.summary?.verified < 1)
    throw new Error("Global cydetix SAFE remediation was not verified.");
  const npxVersion = run(
    process.execPath,
    [
      npmCli,
      "exec",
      "--offline",
      "--yes",
      `--package=${pathToFileURL(tarball).href}`,
      "--",
      binaryName,
      "--version",
    ],
    npxConsumer,
  ).trim();
  if (npxVersion !== packageJson.version) throw new Error("Packed npx CLI version mismatch.");
  const npxDefault = run(
    process.execPath,
    [
      npmCli,
      "exec",
      "--offline",
      "--yes",
      `--package=${pathToFileURL(tarball).href}`,
      "--",
      binaryName,
    ],
    npxFixture,
  );
  if (!npxDefault.startsWith("Cydetix\n\nScanning "))
    throw new Error("Packed npx zero-config scan failed.");
  const npxSetup = run(
    process.execPath,
    [
      npmCli,
      "exec",
      "--offline",
      "--yes",
      `--package=${pathToFileURL(tarball).href}`,
      "--",
      binaryName,
      "setup",
      "--agent",
      "generic-mcp",
      "--yes",
      "--project",
      npxFixture,
    ],
    npxConsumer,
    120_000,
    [3],
  );
  if (npxSetup !== "") throw new Error("Ephemeral npm-exec setup emitted unexpected stdout.");
  await access(path.join(npxFixture, ".cydetix", "mcp.json")).then(
    () => {
      throw new Error("Ephemeral npm-exec setup wrote an MCP config.");
    },
    () => undefined,
  );
  const npxStatus = run(
    process.execPath,
    [
      npmCli,
      "exec",
      "--offline",
      "--yes",
      `--package=${pathToFileURL(tarball).href}`,
      "--",
      binaryName,
      "setup",
      "--agent",
      "generic-mcp",
      "--status",
      "--project",
      npxFixture,
    ],
    npxConsumer,
    120_000,
    [3],
  );
  if (npxStatus !== "") throw new Error("Ephemeral npm-exec status emitted unexpected stdout.");
  const help = run(process.execPath, [cli, "--help"], consumer);
  if (!help.includes("Detect and configure supported AI coding agents"))
    throw new Error("Packed CLI help contract failed.");
  const doctor = JSON.parse(run(process.execPath, [cli, "doctor"], consumer));
  if (doctor.deterministicEngine !== "available") throw new Error("Packed doctor failed.");
  const agentDoctor = JSON.parse(
    run(process.execPath, [cli, "doctor", "--agent", "--project-root", fixture], consumer),
  );
  if (
    agentDoctor.agent?.versionExact !== true ||
    agentDoctor.agent?.projectRoot !== (await realpath(fixture)) ||
    agentDoctor.agent?.packageManagerRequired !== false ||
    agentDoctor.agent?.networkRequired !== false ||
    agentDoctor.agent?.mcpStartup !== "available"
  )
    throw new Error("Packed agent doctor contract failed.");
  const agentCompatibility = JSON.parse(
    run(
      process.execPath,
      [cli, "doctor", "--agents", "--format", "json", "--project-root", fixture],
      consumer,
    ),
  );
  if (
    agentCompatibility.schemaVersion !== "1.0.0" ||
    agentCompatibility.runtimeVersion !== packageJson.version ||
    agentCompatibility.projectRoot !== (await realpath(fixture)) ||
    agentCompatibility.projectRootCanonical !== true ||
    agentCompatibility.agents?.length !== 11
  )
    throw new Error("Packed universal agent diagnostics contract failed.");
  const scan = JSON.parse(
    run(process.execPath, [cli, "scan", fixture, "--format", "json"], consumer),
  );
  if (!Array.isArray(scan.findings)) throw new Error("Packed scan did not return findings.");
  const defaultHuman = run(process.execPath, [cli], fixture);
  if (!defaultHuman.startsWith("Cydetix\n\nScanning "))
    throw new Error("Packed zero-config default scan did not use concise human mode.");
  const defaultJson = JSON.parse(run(process.execPath, [cli, "--json"], fixture));
  if (defaultJson.tool?.name !== "cydetix")
    throw new Error("Packed zero-config JSON scan identity mismatch.");
  const authentication = JSON.parse(
    run(process.execPath, [cli, "auth", fixture, "--offline", "--format", "json"], consumer),
  );
  if (authentication.securityAnalysis?.authenticationAnalysis === undefined)
    throw new Error("Packed authentication analysis was not produced.");
  const supplyChain = JSON.parse(
    run(
      process.execPath,
      [cli, "supply-chain", consumer, "--advisories", "offline", "--format", "json"],
      consumer,
    ),
  );
  if (!Array.isArray(supplyChain.inventory?.packages))
    throw new Error("Packed supply-chain analysis was not produced.");
  const sbom = JSON.parse(
    run(process.execPath, [cli, "sbom", consumer, "--format", "json"], consumer),
  );
  if (sbom.bomFormat !== "CycloneDX") throw new Error("Packed CycloneDX SBOM was not produced.");
  const dryRun = JSON.parse(
    run(
      process.execPath,
      [cli, "fix", fixture, "--dry-run", "--format", "json"],
      consumer,
      120_000,
      [0, 1],
    ),
  );
  if (
    dryRun.dryRun !== true ||
    dryRun.transactions.length !== 0 ||
    !dryRun.plans.some((plan) => plan.classification === "SAFE")
  )
    throw new Error("Packed remediation dry-run contract failed.");
  const skillNames = ["cydetix"];
  for (const name of skillNames) {
    const skill = await readFile(
      path.join(installedRoot, "agent-skills", name, "SKILL.md"),
      "utf8",
    );
    if (
      !skill.startsWith("---\n") ||
      skill.includes(["Z:", "private-workspace-sentinel"].join("\\"))
    )
      throw new Error(`Packed Agent Skill is invalid or non-portable: ${name}`);
  }
  const setupOutput = run(
    process.execPath,
    [cli, "setup", "--agent", "generic-mcp", "--yes", "--project", fixture],
    consumer,
  );
  if (!setupOutput.includes("Now ask your AI")) throw new Error("Packed setup UX failed.");
  const autoStatus = run(
    process.execPath,
    [cli, "setup", "--agent", "auto", "--status", "--project", fixture],
    consumer,
  );
  if (!autoStatus.includes("No configuration changes were made."))
    throw new Error("Packed automatic agent discovery failed.");
  const setupConfig = JSON.parse(
    await readFile(path.join(fixture, ".cydetix", "mcp.json"), "utf8"),
  );
  const configuredServer = setupConfig.mcpServers?.cydetix;
  if (
    configuredServer?.command !== (await realpath(process.execPath)) ||
    configuredServer.args?.[0] !== (await realpath(cli)) ||
    !configuredServer.args?.includes("--project-root") ||
    !configuredServer.args?.includes(await realpath(fixture)) ||
    !configuredServer.args?.includes("--require-version") ||
    !configuredServer.args?.includes(packageJson.version) ||
    /\bn(?:pm|px)\b|registry\./iu.test(JSON.stringify(configuredServer))
  )
    throw new Error("Packed setup did not pin an exact direct MCP runtime.");
  const printedMcp = JSON.parse(
    run(process.execPath, [cli, "mcp-config", "--format", "json", "--project", fixture], consumer),
  ).mcpServers?.cydetix;
  if (JSON.stringify(printedMcp) !== JSON.stringify(configuredServer))
    throw new Error("Packed printable MCP definition differs from installed Generic MCP config.");
  const olderLauncher = path.join(
    olderGlobalBin,
    process.platform === "win32" ? "cydetix.cmd" : "cydetix",
  );
  await writeFile(
    olderLauncher,
    process.platform === "win32"
      ? "@echo 0.6.0-alpha.6\r\n"
      : "#!/bin/sh\nprintf '0.6.0-alpha.6\\n'\n",
    { mode: 0o700 },
  );
  const mcpInput = `${[
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {} },
    },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  ]
    .map((request) => JSON.stringify(request))
    .join("\n")}\n`;
  const mcpOutput = run(
    configuredServer.command,
    configuredServer.args,
    consumer,
    120_000,
    [0],
    mcpInput,
    { PATH: olderGlobalBin, CYDETIX_AGENT_SUBPROCESS: "1" },
  );
  const [mcpInitialize, mcp] = mcpOutput
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line));
  if (
    mcp.result?.tools?.length !== 3 ||
    mcpInitialize.result?.serverInfo?.version !== packageJson.version
  )
    throw new Error("Packed MCP server validation failed with an older global binary on PATH.");
  const agentScan = JSON.parse(
    run(
      configuredServer.command,
      [
        configuredServer.args[0],
        "scan",
        await realpath(fixture),
        "--offline",
        "--format",
        "json",
        "--non-interactive",
      ],
      consumer,
      120_000,
      [0],
      "",
      { PATH: olderGlobalBin, CYDETIX_AGENT_SUBPROCESS: "1" },
    ),
  );
  if (!Array.isArray(agentScan.findings))
    throw new Error("Packed direct agent CLI scan did not return strict JSON.");
  await writeFile(
    evidencePath,
    `${JSON.stringify(
      {
        schemaVersion: "1.0.0",
        state: "PASSED",
        version,
        packedVersion: packedVersion ?? installedPackageJson.version,
        productVersion: installedProduct.version,
        platform: `${process.platform}-${process.arch}`,
        skillCount: skillNames.length,
        globalLauncherPresent: true,
        lifecycleScriptsExecuted: false,
        artifactSource: suppliedTarball === undefined ? "SOURCE_PACK" : "SUPPLIED_RELEASE_TARBALL",
        commands: [
          "--version",
          "global cydetix launcher --version",
          "global cydetix default scan",
          "global cydetix --help",
          "global cydetix setup",
          "global cydetix setup --status",
          "global cydetix setup --verify",
          "global cydetix fix",
          "npm exec cydetix from local tarball",
          "npm exec cydetix default scan from local tarball",
          "npm exec setup refusal from ephemeral runtime",
          "npm exec status refusal from ephemeral runtime",
          "--help",
          "doctor",
          "doctor --agent --project-root",
          "doctor --agents --format json",
          "zero-config default scan",
          "zero-config --json scan",
          "scan",
          "auth",
          "supply-chain --advisories offline",
          "sbom",
          "fix --dry-run",
          "setup --agent generic-mcp",
          "setup --agent auto --status",
          "mcp-config --format json",
          "configured direct MCP tools/list with an older global Cydetix on PATH",
          "configured direct agent scan with an older global Cydetix on PATH",
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  process.stdout.write(`Packed install smoke passed for ${packageJson.name} ${version}.\n`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
