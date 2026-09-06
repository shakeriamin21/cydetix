import { z } from "zod";
import { corpusValidationResultSchema } from "./model.js";
import { sandboxCapabilitySchema } from "../verification/model.js";
export const releaseValidationSchemaVersion = "1.2.0";
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
export const releaseValidationReportSchema = z
    .object({
    schemaVersion: z.literal(releaseValidationSchemaVersion),
    generatedAt: z.iso.datetime(),
    product: z
        .object({
        name: z.literal("vibeshield"),
        version: z.string().min(1),
        evidenceOrigin: z.enum(["INTERNAL_VERIFIED_EXPORT", "PUBLIC_GIT_COMMIT"]),
        publicSourceCommit: z
            .string()
            .regex(/^[a-f0-9]{40}$/)
            .optional(),
    })
        .strict()
        .refine((product) => product.evidenceOrigin !== "PUBLIC_GIT_COMMIT" ||
        product.publicSourceCommit !== undefined, "Public Git evidence requires a public source commit."),
    verdict: z.enum([
        "NOT_READY_FOR_PUBLIC_USE",
        "INTERNAL_ALPHA_READY",
        "PUBLIC_ALPHA_READY_WITH_LIMITATIONS",
        "PUBLIC_BETA_CANDIDATE",
    ]),
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
})
    .strict();
//# sourceMappingURL=release.js.map