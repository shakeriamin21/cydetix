import { describe, expect, it } from "vitest";
import { scanRepository } from "../../src/core/engine.js";
import {
  renderHuman,
  decisionCategory,
  renderRemediationHuman,
} from "../../src/reporting/human.js";
import { runRemediation } from "../../src/remediation/fix.js";
import { renderFinding } from "../../src/reporting/text.js";
import { toSarif } from "../../src/reporting/sarif.js";
import { unknownEvidence } from "../../src/reporting/uncertainty.js";
import { createMcpServerContext, handleMcpRequest } from "../../src/mcp/server.js";

describe("alpha.12 evidence presentation", () => {
  it("shows exact SAFE verification and does not infer successful rollback", async () => {
    const report = await runRemediation({ path: "fixtures/autofix/vulnerable", dryRun: true });
    const text = renderRemediationHuman(report);
    expect(text).toContain("Only the exact planned transform");
    expect(text).toContain("Preconditions:");
    expect(text).toContain("SECURITY_INVARIANT");
    expect(text).toContain("Rollback:");
    report.dryRun = false;
    report.summary.verificationFailed = 1;
    const failed = renderRemediationHuman(report);
    expect(failed).toContain("Inspect each transaction's final state");
    expect(failed).not.toContain("restored the repository safely");
  });
  it("keeps UNKNOWN useful when there is no actionable finding", async () => {
    const report = await scanRepository({ path: "fixtures/batch2/xss/unknown" });
    expect(unknownEvidence(report).length).toBeGreaterThan(0);
    const human = renderHuman(report);
    expect(human).toContain("REVIEW COVERAGE");
    expect(human).toContain("UNKNOWN proof instances:");
    expect(human).toContain("cannot establish the invariant");
    expect(human).not.toContain("NO ACTIONABLE ISSUES");
  });

  it("does not turn unknown reachability into unknown proof", async () => {
    const report = await scanRepository({ path: "fixtures/batch2/xss/positive" });
    const original = report.findings[0];
    expect(original).toBeDefined();
    if (original === undefined) throw new Error("Missing fixture finding");
    const finding = { ...original, reachability: "unknown" as const };
    expect(decisionCategory(finding)).toBe("REVIEW");
    expect(renderFinding(finding)).toContain("Proof: PROVEN_INSECURE");
    expect(renderFinding(finding)).toContain("Reachability: unknown");
    expect(renderFinding(finding)).toContain("Verification: not_attempted");
  });

  it("presents the same proof and authority in text, JSON, SARIF and MCP explain", async () => {
    const target = "fixtures/batch2/redirect/positive";
    const report = await scanRepository({ path: target });
    const finding = report.findings[0];
    if (finding === undefined) throw new Error("Missing redirect finding");
    const response = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "cydetix_explain",
          arguments: { path: target, finding: finding.fingerprint },
        },
      },
      await createMcpServerContext({ projectRoot: "." }),
    );
    const result = response?.result as {
      content: Array<{ text: string }>;
      structuredContent: { finding: unknown };
    };
    expect(result.content[0]?.text).toBe(`${renderFinding(finding)}\n`);
    expect(result.structuredContent.finding).toEqual(finding);
    const sarif = toSarif(report).runs[0] as {
      results: Array<{ properties: Record<string, unknown> }>;
    };
    expect(sarif.results[0]?.properties).toMatchObject({
      proof: finding.proof,
      proofState: finding.proofState,
      analysisCompleteness: finding.analysisCompleteness,
      confidence: finding.confidence,
      reachability: finding.reachability,
      autofix: finding.autofix,
      verificationStatus: finding.verificationStatus,
    });
    expect(renderFinding(finding)).toContain("SOURCE");
    expect(renderFinding(finding)).toContain("SINK");
    expect(renderFinding(finding)).toContain(
      "REVIEW_REQUIRED: Cydetix has no independently verifiable SAFE transformation",
    );
  });

  it("keeps terminal controls escaped and distinguishes truncation from clean analysis", async () => {
    const report = await scanRepository({ path: "fixtures/typescript/secure" });
    if (report.reproducibility === undefined) throw new Error("Missing completeness");
    report.reproducibility.analysisCompleteness = "TRUNCATED";
    report.manifest.root = "unsafe\u001b[31mproject";
    const text = renderHuman(report);
    expect(text).not.toContain("\u001b");
    expect(text).toContain("REVIEW COVERAGE");
    expect(text).toContain("TRUNCATED");
  });
});
