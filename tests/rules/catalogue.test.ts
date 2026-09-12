import { describe, expect, it } from "vitest";

import { ruleDefinitionSchema } from "../../src/core/schema.js";
import { RULES } from "../../src/rule-engine/catalogue.js";

describe("rule catalogue", () => {
  it("contains unique, schema-valid rules with standards and references", () => {
    expect(RULES).toHaveLength(27);
    expect(new Set(RULES.map((rule) => rule.id)).size).toBe(RULES.length);
    for (const rule of RULES) {
      expect(() => ruleDefinitionSchema.parse(rule)).not.toThrow();
      expect(rule.standards.cwe.length).toBeGreaterThan(0);
      expect(rule.standards.owaspTop10.length).toBeGreaterThan(0);
      if (!["dependency-security", "ci-cd", "supply-chain"].includes(rule.category)) {
        expect(rule.standards.asvs.length).toBeGreaterThan(0);
      }
      expect(rule.references.length).toBeGreaterThan(0);
    }
  });
});
