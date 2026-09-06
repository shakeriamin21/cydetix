import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { selectCydetixTool } from "../../src/integrations/triggers.js";
import { CYDETIX_MCP_TOOLS } from "../../src/mcp/server.js";

interface TriggerCase {
  readonly prompt: string;
  readonly expected: "cydetix_scan" | "cydetix_fix" | null;
}

describe("agent trigger descriptor proxy", () => {
  const corpus = JSON.parse(
    readFileSync(path.resolve("validation", "agent-trigger-corpus.json"), "utf8"),
  ) as { cases: TriggerCase[] };

  it("keeps autonomous-selection and mutation boundaries in the public descriptions", () => {
    const scan = CYDETIX_MCP_TOOLS.find((tool) => tool.name === "cydetix_scan");
    const fix = CYDETIX_MCP_TOOLS.find((tool) => tool.name === "cydetix_fix");
    const scanDescription = scan?.description.toLowerCase() ?? "";
    for (const term of ["check", "audit", "review", "security", "harden", "vulnerabilities"])
      expect(scanDescription).toContain(term);
    for (const term of [
      "authentication",
      "authorization",
      "sessions",
      "jwt",
      "oauth",
      "secrets",
      "dependencies",
      "supply chain",
      "ci/cd",
    ])
      expect(scanDescription).toContain(term);
    expect(fix?.description).toContain("Use only when the user explicitly asks");
    expect(fix?.description).toContain("SAFE");
    expect(fix?.description).toContain("REVIEW_REQUIRED");
    expect(fix?.description).toContain("ARCHITECTURAL");
  });

  for (const entry of corpus.cases) {
    it(entry.prompt, () => {
      expect(selectCydetixTool(entry.prompt) ?? null).toBe(entry.expected);
    });
  }
});
