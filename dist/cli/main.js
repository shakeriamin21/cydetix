#!/usr/bin/env node
import { accessSync, constants, existsSync } from "node:fs";
import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command, CommanderError, InvalidArgumentError } from "commander";
import { PRODUCT } from "../core/brand.js";
import { scanRepository } from "../core/engine.js";
import { CydetixError, EXIT } from "../core/errors.js";
import { probeExternalTool } from "../external-tools/model.js";
import { parseAgentId, runAutomaticIntegration, runSetup } from "../integrations/setup.js";
import { resolvePersistentRuntime } from "../integrations/runtime.js";
import { createMcpServerContext, runMcpServer } from "../mcp/server.js";
import { createBoundary } from "../repository-discovery/boundary.js";
import { CONFIG_NAME } from "../repository-discovery/config.js";
import { RULES, RULE_BY_ID } from "../rule-engine/catalogue.js";
import { runRemediation } from "../remediation/fix.js";
import { remediationReportSchema } from "../remediation/model.js";
import { renderJson } from "../reporting/json.js";
import { renderAuthenticationGraphText, renderAuthenticationText, } from "../reporting/authentication.js";
import { renderSarif } from "../reporting/sarif.js";
import { renderHuman, renderRemediationHuman } from "../reporting/human.js";
import { terminalSafe } from "../reporting/terminal.js";
import { renderText } from "../reporting/text.js";
import { renderSupplyChainText } from "../reporting/supply-chain.js";
import { renderRemediationText } from "../reporting/remediation.js";
import { generateCycloneDxSbom } from "../supply-chain/sbom.js";
import { createContainerSandboxRunner, createLocalExplicitRunner, createNoExecutionRunner, } from "../verification/runner.js";
const SEVERITY_RANK = {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
};
const CONFIDENCE_RANK = { low: 0, medium: 1, high: 2 };
function severity(value) {
    if (value in SEVERITY_RANK)
        return value;
    throw new InvalidArgumentError("Expected one of: info, low, medium, high, critical.");
}
function confidence(value) {
    if (value in CONFIDENCE_RANK)
        return value;
    throw new InvalidArgumentError("Expected one of: low, medium, high.");
}
function format(value) {
    if (["text", "json", "sarif"].includes(value))
        return value;
    throw new InvalidArgumentError("Expected one of: text, json, sarif.");
}
function graphFormat(value) {
    if (["text", "json"].includes(value))
        return value;
    throw new InvalidArgumentError("Expected one of: text, json.");
}
function advisoryMode(value) {
    if (value === "offline" || value === "online")
        return value;
    throw new InvalidArgumentError("Expected one of: offline, online.");
}
function collectString(value, previous) {
    return [...previous, value];
}
function collectAgent(value, previous) {
    try {
        return [...previous, parseAgentId(value)];
    }
    catch (error) {
        throw new InvalidArgumentError(error instanceof Error ? error.message : String(error));
    }
}
function trustedCommands(values) {
    return values.map((value) => {
        let parsed;
        try {
            parsed = JSON.parse(value);
        }
        catch {
            throw new InvalidArgumentError('--verify-command must be a JSON string array such as ["npm","test"].');
        }
        if (!Array.isArray(parsed) ||
            parsed.length === 0 ||
            !parsed.every((item) => typeof item === "string")) {
            throw new InvalidArgumentError("--verify-command must be a non-empty JSON string array.");
        }
        const [executable, ...arguments_] = parsed;
        if (executable === undefined || executable.trim() === "")
            throw new InvalidArgumentError("--verify-command executable cannot be empty.");
        return { executable, arguments: arguments_ };
    });
}
function verificationRunner(mode, image) {
    if (mode === "none")
        return createNoExecutionRunner();
    if (mode === "local")
        return createLocalExplicitRunner();
    if (mode === "container") {
        if (image === undefined || image.trim() === "")
            throw new InvalidArgumentError("--sandbox-image with an immutable sha256 digest is required for container verification.");
        return createContainerSandboxRunner({ image });
    }
    throw new InvalidArgumentError("Expected --verification-runner none, local, or container.");
}
function recount(report) {
    report.summary.critical = 0;
    report.summary.high = 0;
    report.summary.medium = 0;
    report.summary.low = 0;
    report.summary.info = 0;
    for (const finding of report.findings)
        report.summary[finding.severity] += 1;
}
function filterReport(report, minimumSeverity, minimumConfidence) {
    report.findings = report.findings.filter((finding) => SEVERITY_RANK[finding.severity] >= SEVERITY_RANK[minimumSeverity] &&
        CONFIDENCE_RANK[finding.confidence] >= CONFIDENCE_RANK[minimumConfidence]);
    recount(report);
    return report;
}
function output(report, selectedFormat) {
    if (selectedFormat === "json")
        process.stdout.write(renderJson(report));
    else if (selectedFormat === "sarif")
        process.stdout.write(renderSarif(report));
    else
        process.stdout.write(renderText(report));
}
async function executeScan(target, options) {
    if (!options.offline) {
        throw new CydetixError("Cydetix is deliberately offline-only; network-backed adapters are not implemented.", EXIT.usage);
    }
    try {
        return filterReport(await scanRepository({ path: target }), options.severity, options.confidence);
    }
    catch (error) {
        if (error instanceof CydetixError)
            throw new CydetixError(error.message, EXIT.scanFailure, { cause: error });
        throw error;
    }
}
async function initRepository(target) {
    const boundary = await createBoundary(target);
    const configPath = path.join(boundary.root, CONFIG_NAME);
    const existingNames = [];
    for (const name of [CONFIG_NAME]) {
        const existing = await lstat(path.join(boundary.root, name)).catch((error) => {
            if (errorCode(error) === "ENOENT")
                return undefined;
            throw error;
        });
        if (existing !== undefined)
            existingNames.push(name);
    }
    if (existingNames.length > 0) {
        throw new CydetixError(`${existingNames.join(" and ")} already exists; refusing to overwrite configuration.`, EXIT.usage);
    }
    const config = {
        schemaVersion: "1.0.0",
        maxFileBytes: 1_048_576,
        maxFiles: 100_000,
        maxDepth: 40,
        additionalIgnore: [],
        baseline: [],
        suppressions: [],
    };
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
    });
    process.stdout.write(`Created ${terminalSafe(configPath)}\n`);
}
function errorCode(error) {
    if (typeof error !== "object" || error === null || !("code" in error))
        return undefined;
    return typeof error.code === "string" ? error.code : undefined;
}
function commandAvailable(command) {
    const pathValue = process.env.PATH ?? "";
    const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
    for (const directory of pathValue.split(path.delimiter)) {
        for (const extension of extensions) {
            const candidate = path.join(directory, `${command}${extension}`);
            if (!existsSync(candidate))
                continue;
            try {
                accessSync(candidate, constants.X_OK);
                return true;
            }
            catch {
                // Continue checking PATH without executing the candidate.
            }
        }
    }
    return false;
}
export function buildProgram() {
    const program = new Command();
    program
        .name(PRODUCT.id)
        .description("Local-first application, authentication, and software supply-chain assurance")
        .version(PRODUCT.version)
        .option("--details", "show complete evidence, coverage, standards, and proof details", false)
        .option("--json", "emit the complete structured scan report as JSON", false)
        .option("--sarif", "emit the complete scan report as SARIF", false)
        .showHelpAfterError()
        .exitOverride()
        .action(async () => {
        const options = program.opts();
        if (options.json && options.sarif)
            throw new CydetixError("Choose only one of --json or --sarif.", EXIT.usage);
        const report = await scanRepository({ path: "." });
        if (options.json)
            process.stdout.write(renderJson(report));
        else if (options.sarif)
            process.stdout.write(renderSarif(report));
        else if (options.details)
            process.stdout.write(renderText(report));
        else {
            process.stdout.write(renderHuman(report));
            try {
                await runAutomaticIntegration({ projectRoot: "." });
            }
            catch (error) {
                if (process.stdin.isTTY && process.stdout.isTTY)
                    process.stdout.write(`\nAI integration: ${terminalSafe(error instanceof Error ? error.message : "needs attention. Run cydetix setup --status.")}\n`);
            }
        }
    });
    program
        .command("init")
        .argument("[path]", "repository root", ".")
        .description("Create an optional bounded, data-only Cydetix configuration")
        .action(initRepository);
    program
        .command("setup")
        .description("Detect and configure supported AI coding agents")
        .option("--agent <name>", "configure one agent even when it was not detected (repeatable)", collectAgent, [])
        .option("--all", "configure every supported adapter", false)
        .option("--yes", "accept setup non-interactively", false)
        .option("--dry-run", "preview integration changes without writing files", false)
        .option("--status", "show host detection and integration status without changes", false)
        .option("--verify", "verify detected integrations without changes", false)
        .option("--remove", "remove only Cydetix-managed integration entries", false)
        .option("--project <path>", "project root for project-scoped integrations", ".")
        .action(async (options) => {
        if ([options.status, options.verify, options.remove].filter(Boolean).length > 1)
            throw new CydetixError("Choose only one of --status, --verify, or --remove.", EXIT.usage);
        const report = await runSetup({
            projectRoot: options.project,
            agents: options.agent,
            all: options.all,
            yes: options.yes,
            dryRun: options.dryRun,
            status: options.status,
            verify: options.verify,
            remove: options.remove,
        });
        if (options.verify && !report.verified)
            process.exitCode = EXIT.verificationFailure;
    });
    program
        .command("scan")
        .argument("[path]", "repository root", ".")
        .description("Run a read-only deterministic security scan")
        .option("--format <format>", "output format", format, "text")
        .option("--severity <level>", "minimum severity", severity, "info")
        .option("--confidence <level>", "minimum confidence", confidence, "low")
        .option("--offline", "forbid network-backed analysis", true)
        .option("--non-interactive", "disable prompts, setup, progress, and terminal styling", false)
        .action(async (target, options) => {
        if (options.nonInteractive)
            process.env.CYDETIX_AGENT_SUBPROCESS = "1";
        output(await executeScan(target, options), options.format);
    });
    program
        .command("auth")
        .argument("[path]", "repository root", ".")
        .description("Reconstruct and report authentication/security architecture evidence")
        .option("--format <format>", "output format", format, "text")
        .option("--severity <level>", "minimum severity", severity, "info")
        .option("--confidence <level>", "minimum confidence", confidence, "low")
        .option("--offline", "forbid network-backed analysis", true)
        .action(async (target, options) => {
        const report = await executeScan(target, options);
        report.findings = report.findings.filter((finding) => [
            "session",
            "password-storage",
            "token-validation",
            "authorization",
            "authentication",
            "password-reset",
            "oauth",
        ].includes(finding.category));
        recount(report);
        if (options.format === "text")
            process.stdout.write(renderAuthenticationText(report));
        else
            output(report, options.format);
    });
    program
        .command("graph")
        .argument("[path]", "repository root", ".")
        .description("Expose evidence-backed authentication graph nodes and edges")
        .requiredOption("--auth", "select the authentication graph")
        .option("--format <format>", "output format", graphFormat, "text")
        .action(async (target, options) => {
        if (!options.auth) {
            throw new CydetixError("Only --auth graph output is implemented.", EXIT.usage);
        }
        const report = await scanRepository({ path: target });
        if (options.format === "json") {
            process.stdout.write(`${JSON.stringify({
                schemaVersion: report.securityAnalysis.authenticationAnalysis?.graphVersion ?? "unavailable",
                authGraph: report.authGraph,
                invariantResults: report.securityAnalysis.authenticationAnalysis?.results ?? [],
            }, null, 2)}\n`);
        }
        else {
            process.stdout.write(renderAuthenticationGraphText(report));
        }
    });
    program
        .command("dependencies")
        .argument("[path]", "repository root", ".")
        .description("Inventory resolved dependencies and optionally query advisories")
        .option("--advisories <mode>", "advisory mode: offline or online", advisoryMode, "offline")
        .option("--format <format>", "output format", graphFormat, "text")
        .action(async (target, options) => {
        const report = await scanRepository({ path: target, advisories: options.advisories });
        const analysis = report.securityAnalysis.supplyChainAnalysis;
        if (analysis === undefined)
            throw new CydetixError("Supply-chain analysis unavailable.", EXIT.scanFailure);
        if (options.format === "json") {
            process.stdout.write(`${JSON.stringify({ inventory: analysis.inventory, advisories: analysis.advisories }, null, 2)}\n`);
        }
        else {
            process.stdout.write(renderSupplyChainText(analysis));
        }
    });
    program
        .command("secrets")
        .argument("[path]", "repository root", ".")
        .description("Run passive, redacted working-tree secret analysis")
        .option("--history", "inspect added lines in Git object history without checkout", false)
        .option("--format <format>", "output format", graphFormat, "text")
        .action(async (target, options) => {
        const report = await scanRepository({ path: target, history: options.history });
        const analysis = report.securityAnalysis.supplyChainAnalysis;
        if (analysis === undefined)
            throw new CydetixError("Secret analysis unavailable.", EXIT.scanFailure);
        if (options.format === "json") {
            process.stdout.write(`${JSON.stringify(analysis.secrets, null, 2)}\n`);
        }
        else {
            process.stdout.write(renderSupplyChainText(analysis));
        }
    });
    program
        .command("supply-chain")
        .argument("[path]", "repository root", ".")
        .description("Correlate dependencies, secrets, CI trust, SBOM, and provenance evidence")
        .option("--advisories <mode>", "advisory mode: offline or online", advisoryMode, "offline")
        .option("--history", "include bounded Git history secret inspection", false)
        .option("--format <format>", "output format", format, "text")
        .action(async (target, options) => {
        const report = await scanRepository({
            path: target,
            advisories: options.advisories,
            history: options.history,
        });
        const analysis = report.securityAnalysis.supplyChainAnalysis;
        if (analysis === undefined)
            throw new CydetixError("Supply-chain analysis unavailable.", EXIT.scanFailure);
        if (options.format === "text")
            process.stdout.write(renderSupplyChainText(analysis));
        else if (options.format === "json")
            process.stdout.write(`${JSON.stringify(analysis, null, 2)}\n`);
        else
            process.stdout.write(renderSarif(report));
    });
    program
        .command("sbom")
        .argument("[path]", "repository root", ".")
        .description("Generate a CycloneDX 1.7 SBOM from lockfile evidence without installation")
        .option("--format <format>", "SBOM output format", graphFormat, "json")
        .action(async (target, options) => {
        if (options.format !== "json") {
            throw new CydetixError("CycloneDX SBOM output currently supports --format json only.", EXIT.usage);
        }
        const report = await scanRepository({ path: target });
        const inventory = report.securityAnalysis.supplyChainAnalysis?.inventory;
        if (inventory === undefined)
            throw new CydetixError("Dependency inventory unavailable.", EXIT.scanFailure);
        process.stdout.write(`${JSON.stringify(generateCycloneDxSbom(inventory), null, 2)}\n`);
    });
    program
        .command("fix")
        .argument("[path]", "repository root", ".")
        .description("Apply and verify only SAFE remediation after explicit fix intent")
        .option("--finding <fingerprint>", "apply one finding by fingerprint")
        .option("--dry-run", "print plans and unified diffs with zero repository writes", false)
        .option("--non-interactive", "never prompt and never widen SAFE policy", false)
        .option("--verify-command <json>", "explicitly authorize one bounded non-shell verification command encoded as a JSON array", collectString, [])
        .option("--verification-runner <mode>", "explicit execution provider: none, local, or container", "local")
        .option("--sandbox-image <digest>", "locally present immutable image identity for container verification")
        .option("--format <format>", "remediation report format", graphFormat, "text")
        .action(async (target, options) => {
        const commands = trustedCommands(options.verifyCommand);
        const selectedRunner = commands.length === 0
            ? undefined
            : verificationRunner(options.verificationRunner, options.sandboxImage);
        const result = await runRemediation({
            path: target,
            dryRun: options.dryRun,
            applySafe: !options.dryRun,
            nonInteractive: options.nonInteractive,
            verificationCommands: commands,
            ...(selectedRunner === undefined ? {} : { verificationRunner: selectedRunner }),
            ...(options.finding === undefined ? {} : { finding: options.finding }),
        });
        process.stdout.write(options.format === "json"
            ? `${JSON.stringify(result, null, 2)}\n`
            : renderRemediationHuman(result));
        if (result.transactions.some((transaction) => [
            "VERIFICATION_FAILED",
            "ROLLBACK_SUCCEEDED",
            "ROLLBACK_FAILED",
            "STALE_FINDING",
            "RESCAN_REQUIRED",
            "SANDBOX_UNAVAILABLE",
            "SANDBOX_MISCONFIGURED",
        ].includes(transaction.finalState)))
            process.exitCode = EXIT.verificationFailure;
        else if (result.transactions.some((transaction) => transaction.finalState === "APPLIED_VERIFIED"))
            process.exitCode = EXIT.verifiedFixApplied;
        else if (!options.dryRun && result.plans.length > 0 && result.transactions.length === 0)
            process.exitCode = EXIT.unsafeRemediation;
        else if (result.summary.residualFindings > 0)
            process.exitCode = EXIT.policyFindings;
    });
    program
        .command("mcp")
        .description("Run the first-party Cydetix stdio MCP server")
        .option("--project-root <path>", "explicit project boundary", ".")
        .option("--require-version <version>", "require an exact Cydetix version before startup")
        .action(async (options) => {
        await runMcpServer({
            projectRoot: options.projectRoot,
            ...(options.requireVersion === undefined
                ? {}
                : { requiredVersion: options.requireVersion }),
        });
    });
    program
        .command("verify")
        .argument("[path]", "repository root", ".")
        .description("Rescan and fail when active high or critical findings remain")
        .option("--format <format>", "output format", format, "text")
        .action(async (target, options) => {
        const report = await scanRepository({ path: target });
        output(report, options.format);
        if (report.findings.some((finding) => SEVERITY_RANK[finding.severity] >= SEVERITY_RANK.high)) {
            process.exitCode = EXIT.policyFindings;
        }
    });
    program
        .command("remediation")
        .description("Inspect a user-controlled remediation report without executing repository code")
        .command("show")
        .argument("<report>", "remediation report JSON file")
        .option("--format <format>", "output format", graphFormat, "text")
        .action(async (reportPath, options) => {
        const absolute = path.resolve(reportPath);
        const stat = await lstat(absolute);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 10_485_760)
            throw new CydetixError("Remediation report must be a regular file no larger than 10 MiB.", EXIT.usage);
        const report = remediationReportSchema.parse(JSON.parse(await readFile(absolute, "utf8")));
        process.stdout.write(options.format === "json"
            ? `${JSON.stringify(report, null, 2)}\n`
            : renderRemediationText(report));
    });
    program
        .command("explain")
        .argument("<rule-id>", "rule identifier, for example AS-SESSION-001")
        .description("Explain a rule and its evidence requirements")
        .action((ruleId) => {
        const rule = RULE_BY_ID.get(ruleId);
        if (rule === undefined)
            throw new CydetixError(`Unknown rule: ${ruleId}`, EXIT.usage);
        process.stdout.write(`${JSON.stringify(rule, null, 2)}\n`);
    });
    program
        .command("standards")
        .description("List implemented standards mappings")
        .action(() => {
        process.stdout.write(`${JSON.stringify({
            asvsVersion: "5.0.0",
            owaspTop10Version: "2025",
            sarifVersion: "2.1.0",
            slsaVersion: "1.2",
            cycloneDxVersion: "1.7",
            spdxVersion: "3.0 (tracked; output not implemented)",
            osvApiVersion: "1.0",
            rules: RULES,
        }, null, 2)}\n`);
    });
    program
        .command("ci")
        .argument("[path]", "repository root", ".")
        .description("Run an offline scan with a deterministic policy gate")
        .option("--format <format>", "output format", format, "sarif")
        .option("--fail-on <level>", "minimum failing severity", severity, "high")
        .action(async (target, options) => {
        const report = await scanRepository({ path: target });
        output(report, options.format);
        if (report.findings.some((finding) => SEVERITY_RANK[finding.severity] >= SEVERITY_RANK[options.failOn])) {
            process.exitCode = EXIT.policyFindings;
        }
    });
    program
        .command("doctor")
        .description("Report local engine and optional adapter availability")
        .option("--agent", "verify the persistent agent runtime without changing integration state")
        .option("--project-root <path>", "explicit project boundary for agent checks", ".")
        .option("--sandbox-image <digest>", "inspect a locally present immutable container verification image")
        .action(async (options) => {
        const sandbox = options.sandboxImage === undefined
            ? {
                state: "NOT_REQUESTED",
                message: "Pass --sandbox-image to probe container isolation.",
            }
            : await createContainerSandboxRunner({ image: options.sandboxImage }).capability();
        const agent = options.agent === true
            ? await (async () => {
                const projectBoundary = await createBoundary(options.projectRoot);
                const runtime = await resolvePersistentRuntime({
                    projectRoot: projectBoundary.root,
                    expectedVersion: PRODUCT.version,
                });
                await createMcpServerContext({
                    projectRoot: projectBoundary.root,
                    requiredVersion: PRODUCT.version,
                });
                const [major, minor] = process.versions.node
                    .split(".")
                    .slice(0, 2)
                    .map((value) => Number(value));
                const nodeSupported = (major === 22 && (minor ?? 0) >= 18) || (major === 24 && (minor ?? 0) >= 11);
                return {
                    mode: "agent",
                    packageName: "cydetix",
                    version: runtime.version,
                    versionExact: runtime.version === PRODUCT.version,
                    nodeExecutable: runtime.nodeExecutable,
                    nodeSupported,
                    entrypoint: runtime.entrypoint,
                    runtimeSource: runtime.source,
                    projectRoot: projectBoundary.root,
                    projectRootCanonical: true,
                    jsonOutput: true,
                    mcpStartup: "available",
                    packageManagerRequired: false,
                    networkRequired: false,
                    agentSubprocessMode: true,
                };
            })()
            : undefined;
        const result = {
            version: PRODUCT.version,
            node: process.version,
            platform: `${process.platform}-${process.arch}`,
            deterministicEngine: "available",
            networkRequired: false,
            optionalAdapters: {
                git: commandAvailable("git"),
                gitleaks: commandAvailable("gitleaks"),
                semgrep: commandAvailable("semgrep"),
                codeql: commandAvailable("codeql"),
            },
            externalTools: {
                gitleaks: probeExternalTool("gitleaks", "gitleaks"),
                osvScanner: probeExternalTool("osv-scanner", "osv-scanner"),
                cosign: probeExternalTool("cosign", "cosign"),
            },
            sandbox,
            ...(agent === undefined ? {} : { agent }),
        };
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    });
    program
        .command("version")
        .description("Print the Cydetix version")
        .action(() => {
        process.stdout.write(`${PRODUCT.version}\n`);
    });
    return program;
}
async function main() {
    try {
        await buildProgram().parseAsync(process.argv);
    }
    catch (error) {
        if (error instanceof CommanderError) {
            if (error.code === "commander.helpDisplayed" || error.code === "commander.version")
                return;
            process.stderr.write(`${terminalSafe(error.message)}\n`);
            process.exitCode = EXIT.usage;
            return;
        }
        if (error instanceof CydetixError) {
            process.stderr.write(`${terminalSafe(error.message)}\n`);
            process.exitCode = error.exitCode;
            return;
        }
        process.stderr.write(`Scan failed safely: ${terminalSafe(error instanceof Error ? error.message : String(error))}\n`);
        process.exitCode = EXIT.scanFailure;
    }
}
void main();
//# sourceMappingURL=main.js.map