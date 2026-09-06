import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { selectVibeShieldTool } from "../../src/integrations/triggers.js";
import { VIBESHIELD_MCP_TOOLS } from "../../src/mcp/server.js";

interface TriggerCase {
  readonly prompt: string;
  readonly expected: "vibeshield_scan" | "vibeshield_fix" | null;
}

describe("agent trigger descriptor proxy", () => {
  const corpus = JSON.parse(
    readFileSync(path.resolve("validation", "agent-trigger-corpus.json"), "utf8"),
  ) as { cases: TriggerCase[] };

  it("keeps autonomous-selection and mutation boundaries in the public descriptions", () => {
    const scan = VIBESHIELD_MCP_TOOLS.find((tool) => tool.name === "vibeshield_scan");
    const fix = VIBESHIELD_MCP_TOOLS.find((tool) => tool.name === "vibeshield_fix");
    expect(scan?.description.toLowerCase()).toMatch(
      /check.*audit.*review.*secure.*harden.*vulnerabilities/u,
    );
    expect(scan?.description.toLowerCase()).toMatch(
      /authentication.*authorization.*secrets.*dependencies.*supply chain.*ci\/cd/u,
    );
    expect(fix?.description).toContain("Use only when the user explicitly asks");
    expect(fix?.description).toContain("SAFE");
    expect(fix?.description).toContain("REVIEW_REQUIRED");
    expect(fix?.description).toContain("ARCHITECTURAL");
  });

  for (const entry of corpus.cases) {
    it(entry.prompt, () => {
      expect(selectVibeShieldTool(entry.prompt) ?? null).toBe(entry.expected);
    });
  }
});
