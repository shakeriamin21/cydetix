import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseSource, type ParsedSource } from "../../src/ast-analysis/parser.js";
import { buildAuthorizationProofs } from "../../src/authorization-analysis/proof.js";
import { buildSecurityIr } from "../../src/call-graph/builder.js";
import { enrichSecurityFacts } from "../../src/dataflow-analysis/security-facts.js";
import type { SourceFile } from "../../src/repository-discovery/traverse.js";
import { tenantIsolationRule } from "../../src/rules/tenant-isolation.js";

function source(relativePath: string, text: string): SourceFile {
  return {
    absolutePath: path.resolve("virtual", relativePath),
    relativePath,
    language: "typescript",
    text,
    size: Buffer.byteLength(text),
  };
}

function analyze(repositorySource: string, protectedRoute = true) {
  const files = [
    source(
      "src/routes.ts",
      `import { getDocument } from "./controller.js";
import { requireAuth } from "./auth.js";
router.get("/documents/:id", ${protectedRoute ? "requireAuth, " : ""}getDocument);`,
    ),
    source(
      "src/auth.ts",
      `import jwt from "jsonwebtoken";
export function requireAuth(req, res, next) {
  const claims = jwt.verify(req.headers.authorization, process.env.JWT_SECRET);
  req.auth = { tenantId: claims.tenantId };
  next();
}`,
    ),
    source(
      "src/controller.ts",
      `import { loadDocument } from "./service.js";
export function getDocument(req, res) {
  return loadDocument(req.params.id, req.auth.tenantId, req.body.tenantId);
}`,
    ),
    source(
      "src/service.ts",
      `import { findDocument } from "./repository.js";
export function loadDocument(id, authTenantId, requestedTenantId) {
  return findDocument(id, authTenantId, requestedTenantId);
}`,
    ),
    source("src/repository.ts", repositorySource),
  ];
  const parsed = new Map<string, ParsedSource>();
  for (const file of files) {
    const result = parseSource(file);
    if (result !== undefined && !("message" in result)) parsed.set(file.relativePath, result);
  }
  const securityIr = enrichSecurityFacts(buildSecurityIr(files, parsed), files, parsed);
  const authorizationProofs = buildAuthorizationProofs(securityIr);
  return { files, securityIr, authorizationProofs };
}

describe("tenant isolation proof", () => {
  it("reports request-controlled tenant scope that overrides authenticated tenant identity", () => {
    const context = analyze(`export function findDocument(id, authTenantId, requestedTenantId) {
  return prisma.document.findFirst({ where: { id, tenantId: requestedTenantId } });
}`);
    const proof = context.authorizationProofs.find(
      (candidate) => candidate.invariant === "tenant-isolation",
    );
    expect(proof?.state).toBe("VIOLATED");
    expect(proof?.explanation).toContain("attacker-controlled tenant identity");
    const findings = tenantIsolationRule.analyze(context);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe("AS-TENANT-001");
    expect(findings[0]?.evidencePath?.at(-1)?.kind).toBe("enforcement");
  });

  it("proves a Prisma tenant selector derived from authenticated context", () => {
    const context = analyze(`export function findDocument(id, authTenantId, requestedTenantId) {
  return prisma.document.findFirst({ where: { id, tenantId: authTenantId } });
}`);
    const proof = context.authorizationProofs.find(
      (candidate) => candidate.invariant === "tenant-isolation",
    );
    expect(proof?.state).toBe("PROVEN");
    expect(tenantIsolationRule.analyze(context)).toEqual([]);
  });

  it("reports omission when authenticated tenant identity reaches the repository unused", () => {
    const context = analyze(`export function findDocument(id, authTenantId, requestedTenantId) {
  return prisma.document.findFirst({ where: { id } });
}`);
    const proof = context.authorizationProofs.find(
      (candidate) => candidate.invariant === "tenant-isolation",
    );
    expect(proof?.state).toBe("VIOLATED");
    expect(proof?.explanation).toContain("omits a tenant constraint");
  });

  it("returns UNKNOWN when no authenticated tenant provenance is proven", () => {
    const context = analyze(
      `export function findDocument(id, authTenantId, requestedTenantId) {
  return prisma.document.findFirst({ where: { id, tenantId: requestedTenantId } });
}`,
      false,
    );
    const proof = context.authorizationProofs.find(
      (candidate) => candidate.invariant === "tenant-isolation",
    );
    expect(proof?.state).toBe("UNKNOWN");
    expect(tenantIsolationRule.analyze(context)).toEqual([]);
  });
});
