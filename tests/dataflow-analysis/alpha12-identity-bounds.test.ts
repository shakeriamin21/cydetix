import { describe, expect, it } from "vitest";
import { writeFile } from "node:fs/promises";
import { scanRepository } from "../../src/core/engine.js";
import { normalizeScanForDeterminism } from "../../src/validation/determinism.js";
import { temporaryDirectory } from "../helpers/temporary.js";

describe("recursive security identity bounds", () => {
  it("terminates recursive derived identities and withholds dependent authorization/tenant claims", async () => {
    const root = await temporaryDirectory("cydetix-a12-identity-cycle-");
    await writeFile(
      `${root}/app.ts`,
      `import express from 'express';
import { PrismaClient } from '@prisma/client';
const app = express(); const prisma = new PrismaClient();
function loop(userId, id, tenantId) { loop(userId, id, tenantId); return prisma.record.findFirst({ where: { id, userId, tenantId } }); }
function handler(req, res) { return loop(req.user.id, req.params.id, req.user.tenantId); }
app.get('/record/:id', handler);`,
    );
    const first = await scanRepository({ path: root, now: new Date("2026-09-13") });
    expect(first.securityAnalysis.securityIr.propagationBounds).toMatchObject({
      status: "TRUNCATED",
      iterations: 8,
      maxIterations: 8,
      maxFacts: 10_000,
    });
    expect(first.securityAnalysis.securityIr.identities).toEqual([]);
    expect(first.reproducibility?.analysisCompleteness).toBe("TRUNCATED");
    expect(first.securityAnalysis.authorizationProofs.length).toBeGreaterThan(0);
    expect(first.securityAnalysis.authorizationProofs.every((p) => p.state === "UNKNOWN")).toBe(
      true,
    );
    expect(
      first.findings.filter((f) => ["AS-AUTHZ-001", "AS-TENANT-001"].includes(f.ruleId)),
    ).toEqual([]);
    const second = await scanRepository({ path: root, now: new Date("2026-09-13") });
    expect(normalizeScanForDeterminism(first)).toEqual(normalizeScanForDeterminism(second));
  });
  it("caps direct identity facts without returning a partial graph as complete", async () => {
    const root = await temporaryDirectory("cydetix-a12-identity-facts-");
    const calls = Array.from({ length: 10_005 }, (_, i) => `sink(req.query.q${i});`).join("\n");
    await writeFile(`${root}/app.ts`, `function handler(req) { ${calls} }`);
    const result = await scanRepository({ path: root });
    expect(result.securityAnalysis.securityIr.propagationBounds).toMatchObject({
      status: "TRUNCATED",
      factsCreated: 10_000,
    });
    expect(result.securityAnalysis.securityIr.identities).toEqual([]);
    expect(
      result.securityAnalysis.securityIr.calls.every((c) =>
        c.arguments.every((a) => a.identityFactIds.length === 0),
      ),
    ).toBe(true);
  });
});
