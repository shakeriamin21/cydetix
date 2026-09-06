import { z } from "zod";

import { irLocationSchema, proofStateSchema } from "../security-ir/model.js";

export const evidencePathStepSchema = z
  .object({
    order: z.number().int().nonnegative(),
    kind: z.enum([
      "route",
      "call",
      "identity",
      "enforcement",
      "resource",
      "credential",
      "authentication",
      "session",
      "token",
      "oauth",
      "validation",
      "revocation",
      "password-reset",
      "dependency",
      "advisory",
      "workflow",
      "secret",
    ]),
    irId: z.string().min(1),
    location: irLocationSchema,
    message: z.string().min(1),
  })
  .strict();

export const authorizationProofSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    id: z.string().regex(/^proof:[a-f0-9]{16}$/),
    invariant: z.enum(["object-authorization", "tenant-isolation"]),
    state: proofStateSchema,
    routeId: z.string().regex(/^route:[a-f0-9]{16}$/),
    resourceOperationId: z.string().regex(/^resource:[a-f0-9]{16}$/),
    subjectIdentityFactIds: z.array(z.string().regex(/^identity:[a-f0-9]{16}$/)),
    evidencePath: z.array(evidencePathStepSchema).min(2),
    explanation: z.string().min(1),
    confidence: z.enum(["low", "medium", "high"]),
    reachability: z.enum(["unknown", "unlikely", "possible", "likely", "confirmed"]),
  })
  .strict();

export type AuthorizationProof = z.infer<typeof authorizationProofSchema>;
export type EvidencePathStep = z.infer<typeof evidencePathStepSchema>;
