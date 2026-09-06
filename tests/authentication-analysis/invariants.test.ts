import path from "node:path";
import { describe, expect, it } from "vitest";

import { scanRepository } from "../../src/core/engine.js";
import { toSarif } from "../../src/reporting/sarif.js";

const FIXTURES = path.resolve("fixtures", "phase3");

async function scan(name: string) {
  return scanRepository({ path: path.join(FIXTURES, name) });
}

function result(report: Awaited<ReturnType<typeof scan>>, invariantId: string) {
  return report.securityAnalysis.authenticationAnalysis?.results.find(
    (candidate) => candidate.invariantId === invariantId,
  );
}

describe("authentication protocol invariant engine", () => {
  it("proves secure and insecure cross-file session lifecycle invariants", async () => {
    const secure = await scan("session-secure");
    const fixation = await scan("session-fixation");
    const logout = await scan("logout-incomplete");

    expect(result(secure, "SESSION_ROTATES_AFTER_AUTHENTICATION")?.conclusion).toBe(
      "PROVEN_SECURE",
    );
    expect(result(secure, "SESSION_INVALIDATED_ON_LOGOUT")?.conclusion).toBe("PROVEN_SECURE");
    expect(result(fixation, "SESSION_ROTATES_AFTER_AUTHENTICATION")?.conclusion).toBe(
      "PROVEN_INSECURE",
    );
    expect(fixation.findings.map((finding) => finding.ruleId)).toEqual(["AS-AUTH-SESSION-001"]);
    expect(result(logout, "SESSION_INVALIDATED_ON_LOGOUT")?.conclusion).toBe("PROVEN_INSECURE");
    expect(logout.findings.map((finding) => finding.ruleId)).toEqual(["AS-AUTH-SESSION-002"]);
  });

  it("distinguishes secure, insecure, and unknown password-reset session handling", async () => {
    const secure = await scan("reset-secure");
    const insecure = await scan("reset-persistent-sessions");
    const unknown = await scan("reset-unknown");

    expect(result(secure, "PASSWORD_RESET_TOKEN_SINGLE_USE")?.conclusion).toBe("PROVEN_SECURE");
    expect(result(secure, "PASSWORD_RESET_INVALIDATES_RELEVANT_SESSIONS")?.conclusion).toBe(
      "PROVEN_SECURE",
    );
    expect(result(insecure, "PASSWORD_RESET_TOKEN_SINGLE_USE")?.conclusion).toBe("PROVEN_INSECURE");
    expect(result(insecure, "PASSWORD_RESET_INVALIDATES_RELEVANT_SESSIONS")?.conclusion).toBe(
      "PROVEN_INSECURE",
    );
    expect(insecure.findings.map((finding) => finding.ruleId).sort()).toEqual([
      "AS-AUTH-RESET-001",
      "AS-AUTH-RESET-002",
    ]);
    const unknownResult = result(unknown, "PASSWORD_RESET_INVALIDATES_RELEVANT_SESSIONS");
    expect(unknownResult?.applicability).toBe("UNKNOWN");
    expect(unknownResult?.conclusion).toBe("UNKNOWN");
    expect(unknown.findings).toEqual([]);
  });

  it("proves complete reset-credential protection and reports only explicit weakness", async () => {
    const secure = await scan("reset-secure");
    const weak = await scan("reset-weak-credential");

    expect(result(secure, "PASSWORD_RESET_CREDENTIAL_PROTECTED")?.conclusion).toBe("PROVEN_SECURE");
    expect(result(weak, "PASSWORD_RESET_CREDENTIAL_PROTECTED")?.conclusion).toBe("PROVEN_INSECURE");
    expect(weak.findings.map((finding) => finding.ruleId)).toEqual(["AS-AUTH-RESET-003"]);
  });

  it("keeps decoded JWT claims untrusted until cryptographic verification", async () => {
    const secure = await scan("jwt-verified");
    const insecure = await scan("jwt-unverified");

    expect(result(secure, "JWT_SIGNATURE_VERIFIED")?.conclusion).toBe("PROVEN_SECURE");
    expect(result(secure, "JWT_EXPECTED_ISSUER_VALIDATED")?.conclusion).toBe("PROVEN_SECURE");
    expect(result(secure, "JWT_EXPECTED_AUDIENCE_VALIDATED")?.conclusion).toBe("PROVEN_SECURE");
    expect(result(insecure, "JWT_SIGNATURE_VERIFIED")?.conclusion).toBe("PROVEN_INSECURE");
    expect(insecure.findings.map((finding) => finding.ruleId)).toEqual(["AS-AUTH-JWT-001"]);
    expect(
      insecure.securityAnalysis.securityIr.enforcements.some(
        (enforcement) => enforcement.kind === "authentication" && enforcement.state === "PROVEN",
      ),
    ).toBe(false);
  });

  it("evaluates state and PKCE with explicit client applicability", async () => {
    const secure = await scan("oauth-secure");
    const brokenState = await scan("oauth-broken-state");
    const missingPkce = await scan("oauth-missing-pkce");

    expect(result(secure, "OAUTH_STATE_VALIDATED")?.conclusion).toBe("PROVEN_SECURE");
    expect(result(secure, "PKCE_REQUIRED_WHERE_APPLICABLE")?.conclusion).toBe("PROVEN_SECURE");
    expect(result(brokenState, "OAUTH_STATE_VALIDATED")?.conclusion).toBe("PROVEN_INSECURE");
    expect(brokenState.findings.map((finding) => finding.ruleId)).toEqual(["AS-AUTH-OAUTH-001"]);
    expect(result(missingPkce, "OAUTH_STATE_VALIDATED")?.conclusion).toBe("PROVEN_SECURE");
    expect(result(missingPkce, "PKCE_REQUIRED_WHERE_APPLICABLE")?.applicability).toBe("APPLICABLE");
    expect(result(missingPkce, "PKCE_REQUIRED_WHERE_APPLICABLE")?.conclusion).toBe(
      "PROVEN_INSECURE",
    );
    expect(missingPkce.findings.map((finding) => finding.ruleId)).toEqual(["AS-AUTH-OAUTH-002"]);
  });

  it("proves a resolved authoritative refresh-token rotation lifecycle", async () => {
    const report = await scan("refresh-rotation");

    expect(result(report, "REFRESH_TOKEN_REPLAY_MITIGATED")?.conclusion).toBe("PROVEN_SECURE");
    expect(report.findings).toEqual([]);
  });

  it("preserves real multi-file evidence, SARIF codeFlows, and redaction", async () => {
    const report = await scan("reset-persistent-sessions");
    for (const finding of report.findings) {
      expect(finding.evidence[0]?.redacted).toBe(true);
      expect(finding.evidence[0]?.excerpt).toBe("[AUTHENTICATION EVIDENCE REDACTED]");
      expect(finding.evidencePath?.length).toBeGreaterThanOrEqual(3);
      expect(new Set(finding.evidencePath?.map((step) => step.location.path)).size).toBeGreaterThan(
        1,
      );
    }
    expect(report.authGraph.nodes.every((node) => (node.sourceEvidence?.length ?? 0) > 0)).toBe(
      true,
    );
    const sarif = toSarif(report) as unknown as {
      readonly runs: ReadonlyArray<{
        readonly results: ReadonlyArray<{ readonly codeFlows?: readonly unknown[] }>;
      }>;
    };
    expect(sarif.runs[0]?.results.every((sarifResult) => sarifResult.codeFlows?.length === 1)).toBe(
      true,
    );
  });

  it("does not infer protocols from unrelated token, state, or session names", async () => {
    const report = await scan("false-positive-traps");
    expect(report.findings).toEqual([]);
    expect(result(report, "JWT_SIGNATURE_VERIFIED")?.conclusion).toBe("PROVEN_SECURE");
    expect(
      report.securityAnalysis.authenticationAnalysis?.operations.some(
        (operation) => operation.protocol === "oauth" || operation.protocol === "password-reset",
      ),
    ).toBe(false);
  });

  it("does not combine authentication lifecycles across nested package boundaries", async () => {
    const report = await scanRepository({ path: FIXTURES });

    expect(
      report.findings.some(
        (finding) =>
          finding.ruleId === "AS-AUTH-RESET-001" &&
          finding.location.path.startsWith("reset-unknown/"),
      ),
    ).toBe(false);
    expect(
      report.findings.some(
        (finding) =>
          finding.ruleId === "AS-AUTH-OAUTH-002" &&
          finding.location.path.startsWith("oauth-broken-state/"),
      ),
    ).toBe(false);
    expect(
      report.findings.some(
        (finding) =>
          finding.ruleId === "AS-AUTH-OAUTH-002" &&
          finding.location.path.startsWith("oauth-missing-pkce/"),
      ),
    ).toBe(true);
  });
});
