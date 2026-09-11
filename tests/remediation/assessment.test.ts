import { describe, expect, it } from "vitest";

import type { RemediationClass, RuleDefinition } from "../../src/core/schema.js";
import { assessRemediation } from "../../src/remediation/assessment.js";
import { requireRule } from "../../src/rule-engine/catalogue.js";

function withCeiling(ceiling: RemediationClass): RuleDefinition {
  return { ...requireRule("AS-SESSION-001"), maxRemediationClass: ceiling, autofix: ceiling };
}

const allSafe = {
  deterministicTransformation: true,
  boundedLocalBlastRadius: true,
  sourceHashVerified: true,
  noBusinessPolicyDecision: true,
  noAuthorizationPolicyInvention: true,
  noArchitectureChange: true,
  noSemanticAmbiguity: true,
  noUnknownSecurityDependency: true,
  independentInvariantVerification: true,
} as const;

describe("remediation assessment monotonicity", () => {
  it("allows a SAFE ceiling to remain SAFE only with every SAFE condition", () => {
    expect(
      assessRemediation({
        rule: withCeiling("SAFE"),
        requestedClass: "SAFE",
        safeConditions: allSafe,
        reasonCodes: ["EXACT_LOCAL_TRANSFORM"],
        verificationStrength: "INVARIANT",
      }).finalClass,
    ).toBe("SAFE");
  });

  it.each([
    ["dynamic expression", { ...allSafe, deterministicTransformation: false }],
    ["insufficient proof", { ...allSafe, independentInvariantVerification: false }],
  ])("downgrades SAFE for %s", (_name, safeConditions) => {
    expect(
      assessRemediation({ rule: withCeiling("SAFE"), requestedClass: "SAFE", safeConditions })
        .finalClass,
    ).toBe("REVIEW_REQUIRED");
  });

  it("never promotes REVIEW_REQUIRED even with perfect verification", () => {
    expect(
      assessRemediation({
        rule: withCeiling("REVIEW_REQUIRED"),
        requestedClass: "SAFE",
        safeConditions: allSafe,
        verificationStrength: "INVARIANT",
      }).finalClass,
    ).toBe("REVIEW_REQUIRED");
  });

  it.each(["SAFE", "REVIEW_REQUIRED", "ARCHITECTURAL"] as const)(
    "keeps an ARCHITECTURAL ceiling architectural when runtime requests %s",
    (requestedClass) => {
      expect(
        assessRemediation({
          rule: withCeiling("ARCHITECTURAL"),
          requestedClass,
          safeConditions: allSafe,
        }).finalClass,
      ).toBe("ARCHITECTURAL");
    },
  );
});
