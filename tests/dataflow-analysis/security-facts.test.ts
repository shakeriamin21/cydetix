import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseSource, type ParsedSource } from "../../src/ast-analysis/parser.js";
import { buildSecurityIr } from "../../src/call-graph/builder.js";
import { enrichSecurityFacts } from "../../src/dataflow-analysis/security-facts.js";
import type { SourceFile } from "../../src/repository-discovery/traverse.js";

function source(relativePath: string, text: string): SourceFile {
  return {
    absolutePath: path.resolve("virtual", relativePath),
    relativePath,
    language: "typescript",
    text,
    size: Buffer.byteLength(text),
  };
}

function analyze(files: readonly SourceFile[]) {
  const parsed = new Map<string, ParsedSource>();
  for (const file of files) {
    const result = parseSource(file);
    if (result !== undefined && !("message" in result)) parsed.set(file.relativePath, result);
  }
  return enrichSecurityFacts(buildSecurityIr(files, parsed), files, parsed);
}

describe("identity trust and resource flow", () => {
  it("propagates trusted authentication and attacker-controlled route input into Prisma selectors", () => {
    const ir = analyze([
      source(
        "src/routes.ts",
        `import { getDocument } from "./controller.js";
import { requireAuth } from "./auth.js";
router.get("/documents/:id", requireAuth, getDocument);`,
      ),
      source(
        "src/auth.ts",
        `import jwt from "jsonwebtoken";
export function requireAuth(req, res, next) {
  const claims = jwt.verify(req.headers.authorization, process.env.JWT_SECRET);
  req.auth = { userId: claims.sub, tenantId: claims.tenantId };
  next();
}`,
      ),
      source(
        "src/controller.ts",
        `import { loadDocument } from "./service.js";
export async function getDocument(req, res) {
  const document = await loadDocument(req.params.id, req.auth.userId, req.auth.tenantId);
  return res.json(document);
}`,
      ),
      source(
        "src/service.ts",
        `import { findDocument } from "./repository.js";
export function loadDocument(id, userId, tenantId) {
  return findDocument(id, userId, tenantId);
}`,
      ),
      source(
        "src/repository.ts",
        `export function findDocument(id, userId, tenantId) {
  return prisma.document.findFirst({ where: { id, ownerId: userId, tenantId } });
}`,
      ),
    ]);

    expect(ir.enforcements.some((fact) => fact.kind === "authentication")).toBe(true);
    expect(
      ir.identities.some(
        (fact) => fact.name === "req.params.id" && fact.trust === "attacker-controlled",
      ),
    ).toBe(true);
    expect(
      ir.identities.some(
        (fact) => fact.name === "req.auth.userId" && fact.trust === "trusted-authenticated",
      ),
    ).toBe(true);

    const operation = ir.resourceOperations[0];
    expect(operation?.resourceType).toBe("document");
    expect(operation?.selectors).toEqual([
      expect.objectContaining({ field: "id", expression: "id", trust: "attacker-controlled" }),
      expect.objectContaining({
        field: "ownerId",
        expression: "userId",
        trust: "trusted-authenticated",
      }),
      expect.objectContaining({
        field: "tenantId",
        expression: "tenantId",
        trust: "trusted-authenticated",
      }),
    ]);
    expect(
      ir.calls.some((call) =>
        call.arguments.some((argument) => argument.identityFactIds.length > 0),
      ),
    ).toBe(true);
  });

  it("keeps auth-looking context UNKNOWN when middleware does not prove verification", () => {
    const ir = analyze([
      source(
        "src/routes.ts",
        `import { getDocument } from "./controller.js";
import { requireAuth } from "./auth.js";
router.get("/documents/:id", requireAuth, getDocument);`,
      ),
      source(
        "src/auth.ts",
        `export function requireAuth(req, res, next) {
  req.auth = req.body;
  next();
}`,
      ),
      source(
        "src/controller.ts",
        `import { findDocument } from "./repository.js";
export function getDocument(req, res) {
  return findDocument(req.params.id, req.auth.userId);
}`,
      ),
      source(
        "src/repository.ts",
        `export function findDocument(id, userId) {
  return prisma.document.findFirst({ where: { id, ownerId: userId } });
}`,
      ),
    ]);

    expect(ir.enforcements.some((fact) => fact.kind === "authentication")).toBe(false);
    expect(
      ir.identities.some((fact) => fact.name === "req.auth.userId" && fact.trust === "unknown"),
    ).toBe(true);
    expect(
      ir.resourceOperations[0]?.selectors.find((item) => item.field === "ownerId")?.trust,
    ).toBe("unknown");
  });

  it("never upgrades a request-body tenant identifier to trusted", () => {
    const ir = analyze([
      source(
        "src/routes.ts",
        `import { getDocument } from "./controller.js";
router.get("/documents/:id", getDocument);`,
      ),
      source(
        "src/controller.ts",
        `import { findDocument } from "./repository.js";
export function getDocument(req, res) {
  return findDocument(req.params.id, req.body.tenantId);
}`,
      ),
      source(
        "src/repository.ts",
        `export function findDocument(id, tenantId) {
  return prisma.document.findFirst({ where: { id, tenantId } });
}`,
      ),
    ]);
    expect(
      ir.resourceOperations[0]?.selectors.find((item) => item.field === "tenantId")?.trust,
    ).toBe("attacker-controlled");
  });

  it("does not trust a handler that is also reachable without proven authentication", () => {
    const ir = analyze([
      source(
        "src/routes.ts",
        `import { getDocument } from "./controller.js";
import { requireAuth } from "./auth.js";
router.get("/private/documents/:id", requireAuth, getDocument);
router.get("/public/documents/:id", getDocument);`,
      ),
      source(
        "src/auth.ts",
        `import jwt from "jsonwebtoken";
export function requireAuth(req, res, next) {
  const claims = jwt.verify(req.headers.authorization, process.env.JWT_SECRET);
  req.auth = claims;
  next();
}`,
      ),
      source(
        "src/controller.ts",
        `import { findDocument } from "./repository.js";
export function getDocument(req, res) {
  return findDocument(req.params.id, req.auth.userId);
}`,
      ),
      source(
        "src/repository.ts",
        `export function findDocument(id, userId) {
  return prisma.document.findFirst({ where: { id, ownerId: userId } });
}`,
      ),
    ]);
    expect(
      ir.resourceOperations[0]?.selectors.find((item) => item.field === "ownerId")?.trust,
    ).toBe("unknown");
  });
});
