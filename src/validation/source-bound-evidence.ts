import { createHash } from "node:crypto";

import { z } from "zod";

export const sourceBoundEvidenceFormatVersion = "1.0.0" as const;

const sha1Schema = z.string().regex(/^[0-9a-f]{40}$/u);
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const repositorySchema = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u);
const relativePathSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.includes("\\") &&
      !value.startsWith("/") &&
      !/^[A-Za-z]:/u.test(value) &&
      !value.split("/").some((segment) => segment === "" || segment === "." || segment === ".."),
    "Evidence paths must be canonical repository-relative paths.",
  );

export const sourceBoundEvidenceResultSchema = z.enum([
  "PASS",
  "FAIL",
  "NOT_CHECKED",
  "SKIPPED_CAPABILITY",
  "NOT_APPLICABLE",
]);

export const sourceBoundEvidenceSubjectSchema = z
  .object({
    kind: z.enum(["FILE", "ARTIFACT", "REPOSITORY"]),
    identity: z.string().min(1),
    sha256: sha256Schema.optional(),
    bytes: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((subject, context) => {
    if ((subject.sha256 === undefined) !== (subject.bytes === undefined))
      context.addIssue({
        code: "custom",
        message: "Evidence subject digest and byte count must be supplied together.",
      });
    if (subject.kind === "FILE" && !relativePathSchema.safeParse(subject.identity).success)
      context.addIssue({
        code: "custom",
        message: "File evidence subjects must use canonical repository-relative paths.",
      });
  });

export const sourceBoundEvidenceEnvelopeSchema = z
  .object({
    evidenceFormatVersion: z.literal(sourceBoundEvidenceFormatVersion),
    evidenceType: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    repository: repositorySchema,
    sourceCommit: sha1Schema,
    producer: z
      .object({
        name: z.string().min(1),
        version: z.string().min(1),
      })
      .strict(),
    result: sourceBoundEvidenceResultSchema,
    subject: sourceBoundEvidenceSubjectSchema,
    details: z.record(z.string(), z.unknown()),
  })
  .strict();

export const sourceBoundEvidenceReferenceSchema = z
  .object({
    evidenceType: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    path: relativePathSchema,
    sha256: sha256Schema,
    required: z.boolean(),
  })
  .strict();

export const sourceBoundEvidenceIndexSchema = z
  .object({
    evidenceFormatVersion: z.literal(sourceBoundEvidenceFormatVersion),
    repository: repositorySchema,
    sourceCommit: sha1Schema,
    evidence: z.array(sourceBoundEvidenceReferenceSchema),
  })
  .strict()
  .superRefine((index, context) => {
    const types = new Set<string>();
    const paths = new Set<string>();
    for (const reference of index.evidence) {
      if (types.has(reference.evidenceType))
        context.addIssue({
          code: "custom",
          message: `Duplicate evidence type ${reference.evidenceType}.`,
        });
      if (paths.has(reference.path))
        context.addIssue({ code: "custom", message: `Duplicate evidence path ${reference.path}.` });
      types.add(reference.evidenceType);
      paths.add(reference.path);
    }
  });

export type SourceBoundEvidenceEnvelope = z.infer<typeof sourceBoundEvidenceEnvelopeSchema>;
export type SourceBoundEvidenceIndex = z.infer<typeof sourceBoundEvidenceIndexSchema>;

export interface EvidenceBlob {
  readonly path: string;
  readonly bytes: Uint8Array;
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function validateSourceBoundEvidenceSet(
  indexInput: unknown,
  blobs: readonly EvidenceBlob[],
  expected: { repository: string; sourceCommit: string },
): ReadonlyMap<string, SourceBoundEvidenceEnvelope> {
  const index = sourceBoundEvidenceIndexSchema.parse(indexInput);
  if (index.repository !== expected.repository)
    throw new Error("Evidence index repository does not match the release candidate.");
  if (index.sourceCommit !== expected.sourceCommit)
    throw new Error("Evidence index source commit does not match the release candidate.");

  const blobsByPath = new Map<string, Uint8Array>();
  for (const blob of blobs) {
    if (blobsByPath.has(blob.path)) throw new Error(`Duplicate evidence blob ${blob.path}.`);
    blobsByPath.set(blob.path, blob.bytes);
  }

  const accepted = new Map<string, SourceBoundEvidenceEnvelope>();
  for (const reference of index.evidence) {
    const bytes = blobsByPath.get(reference.path);
    if (bytes === undefined) {
      if (reference.required)
        throw new Error(`Missing required evidence ${reference.evidenceType}.`);
      continue;
    }
    if (sha256(bytes) !== reference.sha256)
      throw new Error(`Evidence hash mismatch for ${reference.evidenceType}.`);
    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(bytes).toString("utf8"));
    } catch {
      throw new Error(`Evidence ${reference.evidenceType} is not valid JSON.`);
    }
    const envelope = sourceBoundEvidenceEnvelopeSchema.parse(decoded);
    if (envelope.evidenceType !== reference.evidenceType)
      throw new Error(`Evidence type mismatch for ${reference.evidenceType}.`);
    if (envelope.repository !== expected.repository)
      throw new Error(`Evidence repository mismatch for ${reference.evidenceType}.`);
    if (envelope.sourceCommit !== expected.sourceCommit)
      throw new Error(`Evidence source mismatch for ${reference.evidenceType}.`);
    accepted.set(reference.evidenceType, envelope);
  }
  return accepted;
}

export function requireReadyEvidence(
  evidence: ReadonlyMap<string, SourceBoundEvidenceEnvelope>,
  requiredTypes: readonly string[],
): void {
  for (const type of requiredTypes) {
    const record = evidence.get(type);
    if (record === undefined) throw new Error(`Missing required evidence ${type}.`);
    if (record.result !== "PASS")
      throw new Error(`Required evidence ${type} is ${record.result}, not PASS.`);
  }
}
