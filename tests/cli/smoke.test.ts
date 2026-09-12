import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createTrustedIntegrationRoot } from "../../src/integrations/common.js";
import { temporaryDirectorySync } from "../helpers/temporary.js";

interface CliResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

const CLI_HOME = temporaryDirectorySync("cydetix-cli-home-");

function runCli(...arguments_: string[]): CliResult {
  const result = spawnSync(
    process.execPath,
    [
      path.resolve("node_modules", "tsx", "dist", "cli.mjs"),
      path.resolve("src", "cli", "main.ts"),
      ...arguments_,
    ],
    {
      cwd: path.resolve("."),
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 25_000_000,
      env: { ...process.env, CYDETIX_SETUP_HOME: CLI_HOME },
    },
  );
  if (result.error !== undefined) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("CLI smoke contract", () => {
  it("reports the version", () => {
    const result = runCli("version");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("0.6.0-alpha.10\n");
    expect(result.stderr).toBe("");
  });

  it("reports the normalized rule catalogue as JSON", () => {
    const result = runCli("rules", "--format", "json");
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const report = JSON.parse(result.stdout) as {
      cydetixVersion: string;
      catalogueFingerprint: string;
      rules: Array<{ id: string; maturity: string; maxRemediationClass: string }>;
    };
    expect(report.cydetixVersion).toBe("0.6.0-alpha.10");
    expect(report.catalogueFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(report.rules.find((rule) => rule.id === "AS-INJECTION-SQL-001")).toMatchObject({
      maturity: "PRODUCTION",
      maxRemediationClass: "REVIEW_REQUIRED",
    });
  });

  it("reports runtime trust truth as JSON", () => {
    const result = runCli("trust", "--format", "json");
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const report = JSON.parse(result.stdout) as {
      version: string;
      safeRemediationAdapters: string[];
      unsupportedOrIncomplete: string[];
    };
    expect(report.version).toBe("0.6.0-alpha.10");
    expect(report.safeRemediationAdapters).toHaveLength(1);
    expect(report.unsupportedOrIncomplete.length).toBeGreaterThan(0);
  });

  it("scans the current project by default with concise human output", () => {
    const result = runCli();
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^Cydetix\n\nScanning /u);
    expect(result.stdout).not.toContain("SECURITY IR:");
    expect(result.stdout).not.toContain("Standards:");
    expect(result.stdout).not.toContain("Enable automatic security checks");
  });

  it("offers complete structured output from the default command", () => {
    const result = runCli("--json");
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as { tool: { name: string }; findings: unknown[] };
    expect(report.tool.name).toBe("cydetix");
    expect(Array.isArray(report.findings)).toBe(true);
  });

  it("scans a secure repository without a policy failure", () => {
    const result = runCli("scan", "fixtures/typescript/secure", "--offline", "--format", "text");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("COVERAGE");
    expect(result.stdout).toContain("No active findings");
  });

  it("reports integration status without prompting", () => {
    const result = runCli("setup", "--status");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Cydetix Setup");
    expect(result.stdout).toContain("No configuration changes were made.");
    expect(result.stdout).not.toContain("[Y/n]");
  });

  it("accepts explicit automatic setup selection without prompting or mutation", () => {
    const root = temporaryDirectorySync("cydetix-cli-auto-");
    const project = path.join(root, "Project With Spaces");
    mkdirSync(project);
    const result = runCli("setup", "--agent", "auto", "--status", "--project", project);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No configuration changes were made.");
    expect(result.stdout).not.toContain("[Y/n]");
    expect(existsSync(path.join(project, ".cydetix"))).toBe(false);
  });

  it("prints a strict project-bound MCP definition without modifying the project", async () => {
    const root = temporaryDirectorySync("cydetix-cli-mcp-config-");
    const project = path.join(root, "Project With Spaces");
    mkdirSync(project);
    const canonicalProject = (await createTrustedIntegrationRoot(project)).root;
    const result = runCli("mcp-config", "--format", "json", "--project", project);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const server = (
      JSON.parse(result.stdout) as {
        mcpServers: { cydetix: { command: string; args: string[] } };
      }
    ).mcpServers.cydetix;
    expect(server.command).toBe(path.resolve(process.execPath));
    expect(server.args).toEqual([
      expect.stringMatching(/[\\/]dist[\\/]cli[\\/]main\.js$/u),
      "mcp",
      "--project-root",
      canonicalProject,
      "--require-version",
      "0.6.0-alpha.10",
    ]);
    expect(JSON.stringify(server).toLowerCase()).not.toMatch(
      /\b(?:npm|npx|pnpm|yarn|bunx|curl|wget)\b|invoke-webrequest/u,
    );
    expect(existsSync(path.join(project, ".cydetix"))).toBe(false);
  });

  it("uses exit code 1 when a CI finding meets policy", () => {
    const result = runCli(
      "ci",
      "fixtures/typescript/vulnerable",
      "--format",
      "json",
      "--fail-on",
      "high",
    );
    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout) as { findings: unknown[] };
    expect(report.findings.length).toBeGreaterThan(0);
  });

  it("uses exit code 2 for an unknown rule", () => {
    const result = runCli("explain", "AS-NOT-REAL");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Unknown rule");
  });

  it("renders the authentication architecture and invariant counts", () => {
    const result = runCli("auth", "fixtures/phase3/reset-unknown", "--format", "text");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("AUTHENTICATION ARCHITECTURE");
    expect(result.stdout).toContain("SECURITY INVARIANTS");
    expect(result.stdout).toContain("Applicability unknown: 1");
    expect(result.stdout).toContain("PASSWORD_RESET_INVALIDATES_RELEVANT_SESSIONS");
  });

  it("emits machine-readable Authentication Graph v2 output", () => {
    const result = runCli("graph", "fixtures/phase3/jwt-unverified", "--auth", "--format", "json");
    expect(result.status).toBe(0);
    const graph = JSON.parse(result.stdout) as {
      schemaVersion: string;
      authGraph: { nodes: unknown[]; edges: unknown[] };
      invariantResults: unknown[];
    };
    expect(graph.schemaVersion).toBe("2.0.0");
    expect(graph.authGraph.nodes.length).toBeGreaterThan(0);
    expect(graph.authGraph.edges.length).toBeGreaterThan(0);
    expect(graph.invariantResults.length).toBeGreaterThan(0);
  });

  it("uses explicit dry runs and applies only SAFE fixes from the fix command", () => {
    const dryRun = runCli("fix", "fixtures/autofix/vulnerable", "--dry-run", "--format", "json");
    expect(dryRun.status).toBe(1);
    const dryReport = JSON.parse(dryRun.stdout) as { dryRun: boolean; transactions: unknown[] };
    expect(dryReport.dryRun).toBe(true);
    expect(dryReport.transactions).toEqual([]);

    const explicitlySafeDryRun = runCli(
      "fix",
      "fixtures/autofix/vulnerable",
      "--dry-run",
      "--format",
      "json",
    );
    expect(explicitlySafeDryRun.status).toBe(1);
    const explicitlySafeDryReport = JSON.parse(explicitlySafeDryRun.stdout) as {
      dryRun: boolean;
      plans: Array<{ classification: string }>;
      transactions: unknown[];
    };
    expect(explicitlySafeDryReport.dryRun).toBe(true);
    expect(explicitlySafeDryReport.transactions).toEqual([]);
    expect(explicitlySafeDryReport.plans.some((plan) => plan.classification === "SAFE")).toBe(true);

    const review = runCli("fix", "fixtures/phase4/actions-tagged", "--non-interactive");
    expect(review.status).toBe(6);

    const temp = temporaryDirectorySync("cydetix-cli-fix-");
    const target = path.join(temp, "repo");
    cpSync(path.resolve("fixtures", "autofix", "vulnerable"), target, { recursive: true });
    const applied = runCli("fix", target, "--non-interactive");
    expect(applied.status).toBe(5);
    expect(readFileSync(path.join(target, "app.py"), "utf8")).toContain(
      'SESSION_COOKIE_HTTPONLY"] = True',
    );
  });
});
