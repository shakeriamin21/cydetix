import { describe, expect, it } from "vitest";
import path from "node:path";

import { authGraphSchema } from "../../src/core/schema.js";
import { scanRepository } from "../../src/core/engine.js";

describe("authentication graph schema", () => {
  it("represents subject/action/resource/tenant enforcement and lifecycle controls", () => {
    const kinds = [
      "subject",
      "action",
      "resource",
      "tenant",
      "policy",
      "enforcement-point",
      "ownership-check",
      "tenant-scope",
      "session-creation",
      "session-validation",
      "session-storage",
      "session-revocation",
      "password-change",
      "password-reset",
      "oauth",
      "oidc",
      "webauthn",
      "impersonation",
    ] as const;
    const graph = authGraphSchema.parse({
      nodes: kinds.map((kind, index) => ({
        id: `node-${index}`,
        kind,
        label: kind,
        confidence: "high",
      })),
      edges: [
        { from: "node-0", to: "node-1", relation: "authorizes", evidence: "policy" },
        { from: "node-5", to: "node-2", relation: "enforces", evidence: "middleware" },
        { from: "node-6", to: "node-3", relation: "checks-ownership", evidence: "query" },
        { from: "node-7", to: "node-3", relation: "checks-tenant", evidence: "query" },
      ],
      limitations: [],
    });
    expect(graph.nodes).toHaveLength(kinds.length);
    expect(graph.edges.map((edge) => edge.relation)).toEqual([
      "authorizes",
      "enforces",
      "checks-ownership",
      "checks-tenant",
    ]);
  });

  it("projects Phase 2 identity, resource, ownership, and tenant proof states", async () => {
    const objectReport = await scanRepository({
      path: path.resolve("fixtures", "phase2", "express-prisma", "idor-vulnerable"),
    });
    expect(
      objectReport.authGraph.nodes.some(
        (node) => node.kind === "ownership-check" && node.label.includes("VIOLATED"),
      ),
    ).toBe(true);
    expect(objectReport.authGraph.edges.some((edge) => edge.relation === "checks-ownership")).toBe(
      true,
    );
    expect(
      objectReport.authGraph.nodes.some(
        (node) => node.kind === "subject" && node.label.includes("trusted-authenticated"),
      ),
    ).toBe(true);

    const tenantReport = await scanRepository({
      path: path.resolve("fixtures", "phase2", "express-prisma", "tenant-secure"),
    });
    expect(
      tenantReport.authGraph.nodes.some(
        (node) => node.kind === "tenant-scope" && node.label.includes("PROVEN"),
      ),
    ).toBe(true);
    expect(tenantReport.authGraph.edges.some((edge) => edge.relation === "checks-tenant")).toBe(
      true,
    );
  });
});
