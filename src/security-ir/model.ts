import { z } from "zod";

import { stableFingerprint } from "../core/hash.js";
import { supplyChainIrSchema } from "../supply-chain/model.js";

export const securityIrVersion = "1.0.0" as const;

export const proofStateSchema = z.enum(["PROVEN", "VIOLATED", "UNKNOWN"]);
export const identityTrustSchema = z.enum([
  "trusted-authenticated",
  "trusted-constant",
  "attacker-controlled",
  "derived",
  "unknown",
]);

export const irLocationSchema = z
  .object({
    path: z.string().min(1),
    start: z
      .object({
        line: z.number().int().positive(),
        column: z.number().int().nonnegative(),
        offset: z.number().int().nonnegative(),
      })
      .strict(),
    end: z
      .object({
        line: z.number().int().positive(),
        column: z.number().int().nonnegative(),
        offset: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const irEvidenceSchema = z
  .object({
    id: z.string().regex(/^evidence:[a-f0-9]{16}$/),
    kind: z.enum([
      "declaration",
      "import",
      "route-binding",
      "call",
      "identity-source",
      "resource-access",
      "authorization-check",
      "tenant-check",
    ]),
    location: irLocationSchema,
    message: z.string().min(1),
  })
  .strict();

export const irModuleSchema = z
  .object({
    id: z.string().regex(/^module:[a-f0-9]{16}$/),
    path: z.string().min(1),
    language: z.enum(["javascript", "typescript"]),
  })
  .strict();

export const irSymbolSchema = z
  .object({
    id: z.string().regex(/^symbol:[a-f0-9]{16}$/),
    moduleId: z.string().regex(/^module:[a-f0-9]{16}$/),
    name: z.string().min(1),
    kind: z.enum(["function", "method", "variable", "parameter", "import"]),
    exported: z.boolean(),
    parameterNames: z.array(z.string().min(1)),
    location: irLocationSchema,
  })
  .strict();

export const irRouteSchema = z
  .object({
    id: z.string().regex(/^route:[a-f0-9]{16}$/),
    moduleId: z.string().regex(/^module:[a-f0-9]{16}$/),
    framework: z.enum(["Express"]),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path: z.string().min(1),
    handlerSymbolId: z
      .string()
      .regex(/^symbol:[a-f0-9]{16}$/)
      .optional(),
    middlewareSymbolIds: z.array(z.string().regex(/^symbol:[a-f0-9]{16}$/)),
    location: irLocationSchema,
    evidenceIds: z.array(z.string().regex(/^evidence:[a-f0-9]{16}$/)).min(1),
  })
  .strict();

export const irCallArgumentSchema = z
  .object({
    position: z.number().int().nonnegative(),
    expression: z.string().min(1),
    identityFactIds: z.array(z.string().regex(/^identity:[a-f0-9]{16}$/)),
  })
  .strict();

export const irCallSchema = z
  .object({
    id: z.string().regex(/^call:[a-f0-9]{16}$/),
    callerSymbolId: z.string().regex(/^symbol:[a-f0-9]{16}$/),
    calleeName: z.string().min(1),
    receiver: z.string().min(1).optional(),
    resolution: z.enum(["resolved", "unresolved", "dynamic"]),
    calleeSymbolId: z
      .string()
      .regex(/^symbol:[a-f0-9]{16}$/)
      .optional(),
    arguments: z.array(irCallArgumentSchema),
    location: irLocationSchema,
    evidenceIds: z.array(z.string().regex(/^evidence:[a-f0-9]{16}$/)).min(1),
  })
  .strict()
  .superRefine((call, context) => {
    if (call.resolution === "resolved" && call.calleeSymbolId === undefined) {
      context.addIssue({
        code: "custom",
        message: "A resolved call requires calleeSymbolId.",
        path: ["calleeSymbolId"],
      });
    }
    if (call.resolution !== "resolved" && call.calleeSymbolId !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Only resolved calls may include calleeSymbolId.",
        path: ["calleeSymbolId"],
      });
    }
  });

export const identityFactSchema = z
  .object({
    id: z.string().regex(/^identity:[a-f0-9]{16}$/),
    symbolId: z.string().regex(/^symbol:[a-f0-9]{16}$/),
    name: z.string().min(1),
    source: z.enum([
      "authenticated-context",
      "request-param",
      "request-body",
      "request-query",
      "request-header",
      "literal",
      "derived",
      "unknown",
    ]),
    trust: identityTrustSchema,
    derivedFrom: z.array(z.string().regex(/^identity:[a-f0-9]{16}$/)),
    location: irLocationSchema,
    evidenceIds: z.array(z.string().regex(/^evidence:[a-f0-9]{16}$/)).min(1),
  })
  .strict();

export const resourceSelectorSchema = z
  .object({
    field: z.string().min(1),
    expression: z.string().min(1),
    identityFactId: z
      .string()
      .regex(/^identity:[a-f0-9]{16}$/)
      .optional(),
    trust: identityTrustSchema,
  })
  .strict();

export const resourceOperationSchema = z
  .object({
    id: z.string().regex(/^resource:[a-f0-9]{16}$/),
    functionSymbolId: z.string().regex(/^symbol:[a-f0-9]{16}$/),
    technology: z.enum(["Prisma"]),
    resourceType: z.string().min(1),
    operation: z.enum(["create", "read-one", "read-many", "update", "delete"]),
    selectors: z.array(resourceSelectorSchema),
    location: irLocationSchema,
    evidenceIds: z.array(z.string().regex(/^evidence:[a-f0-9]{16}$/)).min(1),
  })
  .strict();

export const enforcementFactSchema = z
  .object({
    id: z.string().regex(/^enforcement:[a-f0-9]{16}$/),
    functionSymbolId: z.string().regex(/^symbol:[a-f0-9]{16}$/),
    kind: z.enum(["authentication", "role", "permission", "ownership", "tenant"]),
    subjectIdentityFactId: z
      .string()
      .regex(/^identity:[a-f0-9]{16}$/)
      .optional(),
    resourceField: z.string().min(1).optional(),
    state: proofStateSchema,
    location: irLocationSchema,
    evidenceIds: z.array(z.string().regex(/^evidence:[a-f0-9]{16}$/)).min(1),
  })
  .strict();

export const irEdgeSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    kind: z.enum([
      "imports",
      "exports",
      "binds-route",
      "calls",
      "passes-identity",
      "derives-identity",
      "reads-resource",
      "writes-resource",
      "enforces-authorization",
      "enforces-tenant",
    ]),
    evidenceIds: z.array(z.string().regex(/^evidence:[a-f0-9]{16}$/)).min(1),
  })
  .strict();

export const securityIrSchema = z
  .object({
    schemaVersion: z.literal(securityIrVersion),
    modules: z.array(irModuleSchema),
    symbols: z.array(irSymbolSchema),
    routes: z.array(irRouteSchema),
    calls: z.array(irCallSchema),
    identities: z.array(identityFactSchema),
    resourceOperations: z.array(resourceOperationSchema),
    enforcements: z.array(enforcementFactSchema),
    evidence: z.array(irEvidenceSchema),
    edges: z.array(irEdgeSchema),
    supplyChain: supplyChainIrSchema.optional(),
    limitations: z.array(z.string().min(1)),
  })
  .strict();

export type ProofState = z.infer<typeof proofStateSchema>;
export type IdentityTrust = z.infer<typeof identityTrustSchema>;
export type IrLocation = z.infer<typeof irLocationSchema>;
export type IrEvidence = z.infer<typeof irEvidenceSchema>;
export type IrModule = z.infer<typeof irModuleSchema>;
export type IrSymbol = z.infer<typeof irSymbolSchema>;
export type IrRoute = z.infer<typeof irRouteSchema>;
export type IrCall = z.infer<typeof irCallSchema>;
export type IdentityFact = z.infer<typeof identityFactSchema>;
export type ResourceOperation = z.infer<typeof resourceOperationSchema>;
export type EnforcementFact = z.infer<typeof enforcementFactSchema>;
export type IrEdge = z.infer<typeof irEdgeSchema>;
export type SecurityIr = z.infer<typeof securityIrSchema>;

export function securityIrId(
  kind:
    "module" | "symbol" | "route" | "call" | "identity" | "resource" | "enforcement" | "evidence",
  ...parts: readonly string[]
): string {
  return `${kind}:${stableFingerprint([securityIrVersion, kind, ...parts]).slice(0, 16)}`;
}

export function emptySecurityIr(limitations: readonly string[] = []): SecurityIr {
  return securityIrSchema.parse({
    schemaVersion: securityIrVersion,
    modules: [],
    symbols: [],
    routes: [],
    calls: [],
    identities: [],
    resourceOperations: [],
    enforcements: [],
    evidence: [],
    edges: [],
    limitations: [...limitations],
  });
}
