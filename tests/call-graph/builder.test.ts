import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseSource, type ParsedSource } from "../../src/ast-analysis/parser.js";
import { buildSecurityIr } from "../../src/call-graph/builder.js";
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

function parseAll(files: readonly SourceFile[]): Map<string, ParsedSource> {
  const parsed = new Map<string, ParsedSource>();
  for (const file of files) {
    const result = parseSource(file);
    if (result !== undefined && !("message" in result)) parsed.set(file.relativePath, result);
  }
  return parsed;
}

describe("cross-file call graph", () => {
  it("resolves an Express route through controller, service, and repository modules", () => {
    const files = [
      source(
        "src/routes.ts",
        `import { getDocument } from "./controller.js";
import { requireAuth } from "./auth.js";
router.get("/documents/:id", requireAuth, getDocument);`,
      ),
      source(
        "src/controller.ts",
        `import { loadDocument } from "./service.js";
export async function getDocument(req, res) {
  return res.json(await loadDocument(req.params.id));
}`,
      ),
      source(
        "src/service.ts",
        `import { findDocument } from "./repository.js";
export async function loadDocument(id) {
  return findDocument(id);
}`,
      ),
      source(
        "src/repository.ts",
        `export async function findDocument(id) {
  return prisma.document.findUnique({ where: { id } });
}`,
      ),
      source("src/auth.ts", `export function requireAuth(req, res, next) { next(); }`),
    ];

    const ir = buildSecurityIr(files, parseAll(files));
    const route = ir.routes[0];
    expect(route?.path).toBe("/documents/:id");
    expect(route?.handlerSymbolId).toBeDefined();
    expect(route?.middlewareSymbolIds).toHaveLength(1);

    const byId = new Map(ir.symbols.map((symbol) => [symbol.id, symbol]));
    const resolvedPairs = ir.calls
      .filter((call) => call.resolution === "resolved")
      .map((call) => [
        byId.get(call.callerSymbolId)?.name,
        call.calleeSymbolId === undefined ? undefined : byId.get(call.calleeSymbolId)?.name,
      ]);
    expect(resolvedPairs).toContainEqual(["getDocument", "loadDocument"]);
    expect(resolvedPairs).toContainEqual(["loadDocument", "findDocument"]);
    expect(ir.calls.find((call) => call.calleeName === "findUnique")?.resolution).toBe(
      "unresolved",
    );
    expect(ir.edges.some((edge) => edge.kind === "imports")).toBe(true);
    expect(ir.edges.some((edge) => edge.kind === "binds-route")).toBe(true);
  });

  it("does not invent a target for computed dispatch", () => {
    const files = [
      source(
        "src/dynamic.ts",
        `export function dispatch(handlers, name, id) {
  return handlers[name](id);
}`,
      ),
    ];
    const ir = buildSecurityIr(files, parseAll(files));
    expect(ir.calls).toHaveLength(1);
    expect(ir.calls[0]?.resolution).toBe("dynamic");
    expect(ir.calls[0]?.calleeSymbolId).toBeUndefined();
    expect(ir.limitations.join(" ")).toContain("UNKNOWN");
  });
});
