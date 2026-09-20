import { z } from "zod";

import { sandboxCapabilitySchema } from "../verification/model.js";
import { corpusValidationResultSchema } from "./model.js";
import { npmReleaseChannelForVersion } from "./release-channel.js";

export const legacyReleaseValidationSchemaVersion = "1.2.0" as const;
export const releaseValidationSchemaVersion = "1.3.0" as const;

export const validationCheckStateSchema = z.enum([
  "executed_pass",
  "executed_fail",
  "skipped_capability",
  "not_applicable",
  "not_checked",
]);

const checkSchema = z
  .object({
    id: z.string().min(1),
    state: validationCheckStateSchema,
    evidence: z.string().min(1),
    tests: z.array(z.string().min(1)).optional(),
    controls: z.array(z.string().min(1)).optional(),
  })
  .strict();

const hashSchema = z
  .object({
    artifact: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().nonnegative(),
  })
  .strict();

const scaleResultSchema = z
  .object({
    name: z.string().min(1),
    wallMilliseconds: z.number().nonnegative(),
    peakRssBytes: z.number().int().nonnegative(),
    files: z.number().int().nonnegative(),
    filesPerSecond: z.number().nonnegative(),
    graphNodes: z.number().int().nonnegative(),
    graphEdges: z.number().int().nonnegative(),
    findings: z.number().int().nonnegative(),
  })
  .strict();

const releaseValidationReportCommonShape = {
  generatedAt: z.iso.datetime(),
  product: z
    .object({
      name: z.literal("cydetix"),
      version: z.string().min(1),
      evidenceOrigin: z.enum(["INTERNAL_VERIFIED_EXPORT", "PUBLIC_GIT_COMMIT"]),
      publicSourceCommit: z
        .string()
        .regex(/^[a-f0-9]{40}$/)
        .optional(),
    })
    .strict()
    .refine(
      (product) =>
        product.evidenceOrigin !== "PUBLIC_GIT_COMMIT" || product.publicSourceCommit !== undefined,
      "Public Git evidence requires a public source commit.",
    ),
  checks: z.array(checkSchema).min(1),
  corpora: z.array(corpusValidationResultSchema),
  sandbox: sandboxCapabilitySchema,
  environment: z
    .object({
      nodeVersion: z.string().min(1),
      npmVersion: z.string().min(1),
      platform: z.string().min(1),
      docker: z
        .object({
          clientVersion: z.string().min(1),
          serverVersion: z.string().min(1),
          serverPlatform: z.string().min(1),
          osType: z.literal("linux"),
          architecture: z.string().min(1),
          kernelVersion: z.string().min(1),
          cgroupVersion: z.string().min(1),
          defaultRuntime: z.string().min(1),
          securityOptions: z.array(z.string().min(1)),
          imageIdentity: z.string().min(1),
          imageRepoDigests: z.array(z.string().min(1)),
        })
        .strict(),
      wsl: z
        .object({
          version: z.string().min(1),
          backend: z.literal("WSL2"),
        })
        .strict()
        .optional(),
    })
    .strict(),
  scorecard: z
    .object({
      state: validationCheckStateSchema,
      version: z.string().min(1).optional(),
      checksRun: z.number().int().nonnegative(),
      score: z.number().min(0).max(10).optional(),
      limitations: z.array(z.string().min(1)),
    })
    .strict(),
  tests: z
    .object({
      filesPassed: z.number().int().nonnegative(),
      testsPassed: z.number().int().nonnegative(),
      filesFailed: z.number().int().nonnegative(),
      testsFailed: z.number().int().nonnegative(),
      filesSkipped: z.number().int().nonnegative(),
      testsSkipped: z.number().int().nonnegative(),
    })
    .strict(),
  performance: z.array(scaleResultSchema),
  package: z.discriminatedUnion("state", [
    z
      .object({
        state: z.literal("CURRENT"),
        entries: z.number().int().positive(),
        packedBytes: z.number().int().positive(),
        unpackedBytes: z.number().int().positive(),
        sizeGateBytes: z.number().int().positive(),
        hashes: z.array(hashSchema),
      })
      .strict(),
    z
      .object({
        state: z.literal("SUPERSEDED_BY_PUBLIC_RENAME"),
        evidence: z.string().min(1),
      })
      .strict(),
  ]),
  supportScope: z.array(z.string().min(1)),
  knownLimitations: z.array(z.string().min(1)),
};

const legacyReleaseValidationVerdictSchema = z.enum([
  "NOT_READY_FOR_PUBLIC_USE",
  "INTERNAL_ALPHA_READY",
  "PUBLIC_ALPHA_READY_WITH_LIMITATIONS",
  "PUBLIC_BETA_CANDIDATE",
]);

export const currentReleaseValidationVerdictSchema = z.enum([
  "NOT_READY_FOR_PUBLIC_USE",
  "PUBLIC_ALPHA_READY_WITH_LIMITATIONS",
  "PUBLIC_BETA_READY_WITH_LIMITATIONS",
  "PUBLIC_STABLE_READY_WITH_LIMITATIONS",
]);

export type CurrentReleaseValidationVerdict = z.infer<typeof currentReleaseValidationVerdictSchema>;

export function releaseValidationVerdictForVersion(
  version: string,
  ready: boolean,
): CurrentReleaseValidationVerdict {
  const channel = npmReleaseChannelForVersion(version);
  if (!ready) {
    return "NOT_READY_FOR_PUBLIC_USE";
  }
  switch (channel) {
    case "alpha":
      return "PUBLIC_ALPHA_READY_WITH_LIMITATIONS";
    case "beta":
      return "PUBLIC_BETA_READY_WITH_LIMITATIONS";
    case "latest":
      return "PUBLIC_STABLE_READY_WITH_LIMITATIONS";
  }
}

export const legacyReleaseValidationReportSchema = z
  .object({
    schemaVersion: z.literal(legacyReleaseValidationSchemaVersion),
    ...releaseValidationReportCommonShape,
    verdict: legacyReleaseValidationVerdictSchema,
  })
  .strict();

export const currentReleaseValidationReportSchema = z
  .object({
    schemaVersion: z.literal(releaseValidationSchemaVersion),
    ...releaseValidationReportCommonShape,
    verdict: currentReleaseValidationVerdictSchema,
  })
  .strict()
  .superRefine((report, context) => {
    let expectedVerdict: CurrentReleaseValidationVerdict;
    try {
      expectedVerdict = releaseValidationVerdictForVersion(
        report.product.version,
        report.verdict !== "NOT_READY_FOR_PUBLIC_USE",
      );
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: ["product", "version"],
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    if (report.verdict !== expectedVerdict) {
      context.addIssue({
        code: "custom",
        path: ["verdict"],
        message: `Release verdict ${report.verdict} contradicts version ${report.product.version}; expected ${expectedVerdict}.`,
      });
    }
  });

/**
 * Compatibility parser for immutable historical reports and current reports.
 * Current release generation and validation must use
 * currentReleaseValidationReportSchema so legacy maturity labels cannot be
 * emitted for new releases.
 */
export const releaseValidationReportSchema = z.discriminatedUnion("schemaVersion", [
  legacyReleaseValidationReportSchema,
  currentReleaseValidationReportSchema,
]);

export type LegacyReleaseValidationReport = z.infer<typeof legacyReleaseValidationReportSchema>;
export type CurrentReleaseValidationReport = z.infer<typeof currentReleaseValidationReportSchema>;
export type ReleaseValidationReport = z.infer<typeof releaseValidationReportSchema>;
