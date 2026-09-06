import { describe, expect, it } from "vitest";

import { emptySecurityIr, securityIrId, securityIrSchema } from "../../src/security-ir/model.js";

const location = {
  path: "src/routes/documents.ts",
  start: { line: 4, column: 0, offset: 40 },
  end: { line: 4, column: 30, offset: 70 },
} as const;

describe("security intermediate representation", () => {
  it("represents a source-backed route, call, identity, resource, and tenant enforcement", () => {
    const moduleId = securityIrId("module", location.path);
    const handlerId = securityIrId("symbol", location.path, "getDocument");
    const serviceId = securityIrId("symbol", "src/services/documents.ts", "loadDocument");
    const routeEvidence = securityIrId("evidence", location.path, "route");
    const callEvidence = securityIrId("evidence", location.path, "call");
    const identityEvidence = securityIrId("evidence", location.path, "identity");
    const resourceEvidence = securityIrId("evidence", location.path, "resource");
    const tenantEvidence = securityIrId("evidence", location.path, "tenant");
    const identityId = securityIrId("identity", location.path, "req.user.tenantId");
    const resourceId = securityIrId("resource", location.path, "document.findFirst");
    const enforcementId = securityIrId("enforcement", location.path, "tenant");

    const ir = securityIrSchema.parse({
      schemaVersion: "1.0.0",
      modules: [{ id: moduleId, path: location.path, language: "typescript" }],
      symbols: [
        {
          id: handlerId,
          moduleId,
          name: "getDocument",
          kind: "function",
          exported: true,
          parameterNames: ["req", "res"],
          location,
        },
        {
          id: serviceId,
          moduleId,
          name: "loadDocument",
          kind: "function",
          exported: false,
          parameterNames: ["id", "tenantId"],
          location,
        },
      ],
      routes: [
        {
          id: securityIrId("route", location.path, "GET", "/documents/:id"),
          moduleId,
          framework: "Express",
          method: "GET",
          path: "/documents/:id",
          handlerSymbolId: handlerId,
          middlewareSymbolIds: [],
          location,
          evidenceIds: [routeEvidence],
        },
      ],
      calls: [
        {
          id: securityIrId("call", location.path, "loadDocument", "40"),
          callerSymbolId: handlerId,
          calleeName: "loadDocument",
          resolution: "resolved",
          calleeSymbolId: serviceId,
          arguments: [{ position: 0, expression: "req.params.id", identityFactIds: [] }],
          location,
          evidenceIds: [callEvidence],
        },
      ],
      identities: [
        {
          id: identityId,
          symbolId: handlerId,
          name: "req.user.tenantId",
          source: "authenticated-context",
          trust: "trusted-authenticated",
          derivedFrom: [],
          location,
          evidenceIds: [identityEvidence],
        },
      ],
      resourceOperations: [
        {
          id: resourceId,
          functionSymbolId: serviceId,
          technology: "Prisma",
          resourceType: "document",
          operation: "read-one",
          selectors: [
            {
              field: "tenantId",
              expression: "tenantId",
              identityFactId: identityId,
              trust: "trusted-authenticated",
            },
          ],
          location,
          evidenceIds: [resourceEvidence],
        },
      ],
      enforcements: [
        {
          id: enforcementId,
          functionSymbolId: serviceId,
          kind: "tenant",
          subjectIdentityFactId: identityId,
          resourceField: "tenantId",
          state: "PROVEN",
          location,
          evidenceIds: [tenantEvidence],
        },
      ],
      evidence: [
        { id: routeEvidence, kind: "route-binding", location, message: "Express GET route" },
        { id: callEvidence, kind: "call", location, message: "Direct local call" },
        {
          id: identityEvidence,
          kind: "identity-source",
          location,
          message: "Authenticated identity",
        },
        {
          id: resourceEvidence,
          kind: "resource-access",
          location,
          message: "Prisma query",
        },
        {
          id: tenantEvidence,
          kind: "tenant-check",
          location,
          message: "Tenant selector",
        },
      ],
      edges: [
        { from: handlerId, to: serviceId, kind: "calls", evidenceIds: [callEvidence] },
        {
          from: serviceId,
          to: resourceId,
          kind: "reads-resource",
          evidenceIds: [resourceEvidence],
        },
        {
          from: enforcementId,
          to: resourceId,
          kind: "enforces-tenant",
          evidenceIds: [tenantEvidence],
        },
      ],
      limitations: [],
    });

    expect(ir.enforcements[0]?.state).toBe("PROVEN");
    expect(ir.identities[0]?.trust).toBe("trusted-authenticated");
  });

  it("uses UNKNOWN explicitly and rejects falsely resolved calls", () => {
    expect(emptySecurityIr(["Dynamic dispatch remains UNKNOWN."]).limitations).toEqual([
      "Dynamic dispatch remains UNKNOWN.",
    ]);

    const unresolvedCall = {
      id: securityIrId("call", "unknown"),
      callerSymbolId: securityIrId("symbol", "caller"),
      calleeName: "computedTarget",
      resolution: "unresolved",
      calleeSymbolId: securityIrId("symbol", "invented"),
      arguments: [],
      location,
      evidenceIds: [securityIrId("evidence", "unknown")],
    };
    expect(() => securityIrSchema.shape.calls.element.parse(unresolvedCall)).toThrow(
      /Only resolved calls/,
    );
  });
});
