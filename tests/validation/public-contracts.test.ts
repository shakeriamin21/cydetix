import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import inventory from "../../validation/alpha12/public-contracts.json" with { type: "json" };
import { CYDETIX_MCP_TOOLS } from "../../src/mcp/server.js";
import { RULES } from "../../src/rule-engine/catalogue.js";
import {
  proofStateSchema,
  confidenceSchema,
  reachabilitySchema,
  remediationClassSchema,
} from "../../src/core/schema.js";
import { EXIT } from "../../src/core/errors.js";

describe("beta stable candidate contracts", () => {
  it("locks independent decision dimensions, rule versions, ceilings, exits and exact tool arguments", () => {
    expect(proofStateSchema.options).toEqual(inventory.states.proof);
    expect(confidenceSchema.options).toEqual(inventory.states.confidence);
    expect(reachabilitySchema.options).toEqual(inventory.states.reachability);
    expect(remediationClassSchema.options).toEqual(inventory.states.remediationAuthority);
    expect(EXIT).toEqual(inventory.exitCodes.values);
    expect(CYDETIX_MCP_TOOLS).toEqual(inventory.mcp.tools);
    expect(
      RULES.map((rule) => ({
        id: rule.id,
        version: rule.version,
        ceiling: rule.maxRemediationClass ?? rule.autofix,
      })),
    ).toEqual(inventory.rules.entries);
  });

  it("requires explicit review when CLI flags or report schemas change", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/inventory-alpha12-contracts.mjs", "--check"],
      {
        shell: false,
        windowsHide: true,
        encoding: "utf8",
        timeout: 30_000,
      },
    );
    expect(result.status, result.stderr).toBe(0);
  });
});
