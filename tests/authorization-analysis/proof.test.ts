import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseSource, type ParsedSource } from "../../src/ast-analysis/parser.js";
import { buildAuthorizationProofs } from "../../src/authorization-analysis/proof.js";
import { buildSecurityIr } from "../../src/call-graph/builder.js";
import { enrichSecurityFacts } from "../../src/dataflow-analysis/security-facts.js";
import type { SourceFile } from "../../src/repository-discovery/traverse.js";
import { objectAuthorizationRule } from "../../src/rules/object-authorization.js";

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
  req.auth = { userId: claims.sub };
  next();
}`,
    ),
    source(
      "src/controller.ts",
      `import { loadDocument } from "./service.js";
export function getDocument(req, res) {
  return loadDocument(req.params.id, req.auth.userId);
}`,
    ),
    source(
      "src/service.ts",
      `import { findDocument } from "./repository.js";
export function loadDocument(id, userId) {
  return findDocument(id, userId);
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

describe("object authorization proof", () => {
  it("proves a cross-file violation and emits a machine-readable evidence path", () => {
    const context = analyze(`export function findDocument(id, userId) {
  return prisma.document.findUnique({ where: { id } });
}`);
    const proof = context.authorizationProofs.find(
      (candidate) => candidate.invariant === "object-authorization",
    );
    expect(proof?.state).toBe("VIOLATED");
    expect(proof?.subjectIdentityFactIds.length).toBeGreaterThan(0);
    expect(new Set(proof?.evidencePath.map((step) => step.kind))).toEqual(
      new Set(["route", "call", "identity", "resource", "enforcement"]),
    );
    expect(proof?.evidencePath.map((step) => step.order)).toEqual(
      proof?.evidencePath.map((_, index) => index),
    );

    const findings = objectAuthorizationRule.analyze(context);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe("AS-AUTHZ-001");
    expect(findings[0]?.evidencePath?.at(0)?.kind).toBe("route");
    expect(findings[0]?.autofix).toBe("ARCHITECTURAL");
  });

  it("proves ownership when the Prisma selector consumes authenticated identity", () => {
    const context = analyze(`export function findDocument(id, userId) {
  return prisma.document.findFirst({ where: { id, ownerId: userId } });
}`);
    expect(
      context.authorizationProofs.find(
        (candidate) => candidate.invariant === "object-authorization",
      )?.state,
    ).toBe("PROVEN");
    expect(objectAuthorizationRule.analyze(context)).toEqual([]);
  });

  it("returns UNKNOWN instead of trusting auth-looking context on an unprotected route", () => {
    const context = analyze(
      `export function findDocument(id, userId) {
  return prisma.document.findUnique({ where: { id } });
}`,
      false,
    );
    expect(
      context.authorizationProofs.find(
        (candidate) => candidate.invariant === "object-authorization",
      )?.state,
    ).toBe("UNKNOWN");
    expect(objectAuthorizationRule.analyze(context)).toEqual([]);
  });
});
