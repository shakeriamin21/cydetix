import path from "node:path";
import { describe, expect, it } from "vitest";

import { scanRepository } from "../../src/core/engine.js";

const FIXTURES = path.resolve("fixtures", "phase3");

const corpus = [
  ["session-secure", []],
  ["session-fixation", ["AS-AUTH-SESSION-001"]],
  ["logout-incomplete", ["AS-AUTH-SESSION-002"]],
  ["reset-secure", []],
  ["reset-persistent-sessions", ["AS-AUTH-RESET-001", "AS-AUTH-RESET-002"]],
  ["reset-weak-credential", ["AS-AUTH-RESET-003"]],
  ["reset-unknown", []],
  ["jwt-verified", []],
  ["jwt-unverified", ["AS-AUTH-JWT-001"]],
  ["oauth-secure", []],
  ["oauth-broken-state", ["AS-AUTH-OAUTH-001"]],
  ["oauth-missing-pkce", ["AS-AUTH-OAUTH-002"]],
  ["refresh-rotation", []],
  ["false-positive-traps", []],
] as const;

describe("Phase 3 multi-file fixture corpus", () => {
  for (const [fixture, expectedRuleIds] of corpus) {
    it(`${fixture} produces only its expected active findings`, async () => {
      const report = await scanRepository({ path: path.join(FIXTURES, fixture) });
      expect(report.schemaVersion).toBe("2.0.0");
      expect(report.coverage.tier).toBe("phase-four");
      expect(report.findings.map((finding) => finding.ruleId).sort()).toEqual(
        [...expectedRuleIds].sort(),
      );
      expect(report.securityAnalysis.authenticationAnalysis?.schemaVersion).toBe("1.0.0");
      expect(report.securityAnalysis.authenticationAnalysis?.graphVersion).toBe("2.0.0");
      expect(report.scan.performanceMilliseconds?.invariantEvaluation).toBeGreaterThanOrEqual(0);
    });
  }
});
