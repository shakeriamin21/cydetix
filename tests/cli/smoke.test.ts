import { spawnSync } from "node:child_process";
import { cpSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { temporaryDirectorySync } from "../helpers/temporary.js";

interface CliResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

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
    },
  );
  if (result.error !== undefined) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("CLI smoke contract", () => {
  it("reports the version", () => {
    const result = runCli("version");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("0.6.0-alpha.1\n");
    expect(result.stderr).toBe("");
  });

  it("scans the current project by default with concise human output", () => {
    const result = runCli();
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^VibeShield\n\nScanning /u);
    expect(result.stdout).not.toContain("SECURITY IR:");
    expect(result.stdout).not.toContain("Standards:");
  });

  it("offers complete structured output from the default command", () => {
    const result = runCli("--json");
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as { tool: { name: string }; findings: unknown[] };
    expect(report.tool.name).toBe("vibeshield");
    expect(Array.isArray(report.findings)).toBe(true);
  });

  it("scans a secure repository without a policy failure", () => {
    const result = runCli("scan", "fixtures/typescript/secure", "--offline", "--format", "text");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("COVERAGE");
    expect(result.stdout).toContain("No active findings");
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
      "--safe",
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

    const review = runCli("fix", "fixtures/phase4/actions-tagged", "--safe", "--non-interactive");
    expect(review.status).toBe(6);

    const temp = temporaryDirectorySync("vibeshield-cli-fix-");
    const target = path.join(temp, "repo");
    cpSync(path.resolve("fixtures", "autofix", "vulnerable"), target, { recursive: true });
    const applied = runCli("fix", target, "--non-interactive");
    expect(applied.status).toBe(5);
    expect(readFileSync(path.join(target, "app.py"), "utf8")).toContain(
      'SESSION_COOKIE_HTTPONLY"] = True',
    );
  });
});
