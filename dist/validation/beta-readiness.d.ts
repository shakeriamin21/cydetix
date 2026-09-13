import { z } from "zod";
export declare const readinessGateSchema: z.ZodObject<{
    id: z.ZodString;
    state: z.ZodEnum<{
        FAILED: "FAILED";
        NOT_RUN: "NOT_RUN";
        PASSED: "PASSED";
        BLOCKED: "BLOCKED";
        NOT_AVAILABLE: "NOT_AVAILABLE";
    }>;
    evidence: z.ZodString;
    sourceCommit: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const betaReadinessSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"1.0.0">;
    sourceCommit: z.ZodString;
    sourceBinding: z.ZodString;
    version: z.ZodLiteral<"0.6.0-alpha.12">;
    baselineCommit: z.ZodLiteral<"4e13b96cc3539e1b623a4c5a12f10a0954776253">;
    baselineTagObject: z.ZodLiteral<"e692f1e23d58157a209f511adb6180d3f489a80c">;
    tests: z.ZodObject<{
        total: z.ZodNumber;
        passed: z.ZodNumber;
        failed: z.ZodNumber;
        skipped: z.ZodNumber;
        sandboxPassed: z.ZodNumber;
        sandboxSkipped: z.ZodNumber;
        evidence: z.ZodString;
    }, z.core.$strict>;
    corpus: z.ZodObject<{
        groundTruth: z.ZodLiteral<"INCOMPLETE">;
        recall: z.ZodNull;
        accuracy: z.ZodNull;
        identities: z.ZodArray<z.ZodObject<{
            repository: z.ZodString;
            commit: z.ZodString;
            scansCompleted: z.ZodNumber;
            determinism: z.ZodEnum<{
                FAILED: "FAILED";
                PASSED: "PASSED";
                NOT_ESTABLISHED: "NOT_ESTABLISHED";
            }>;
            evidence: z.ZodString;
        }, z.core.$strict>>;
        confirmedFP: z.ZodNumber;
        supportedPatternFN: z.ZodNumber;
        adjudicationScope: z.ZodString;
        unadjudicatedFindings: z.ZodNumber;
        fpEvidence: z.ZodArray<z.ZodString>;
        fnEvidence: z.ZodArray<z.ZodString>;
        unknown: z.ZodObject<{
            applicationDataflow: z.ZodNumber;
            authorization: z.ZodNumber;
            authentication: z.ZodNumber;
            findingProof: z.ZodNumber;
            majorCauses: z.ZodArray<z.ZodString>;
            limitation: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>;
    performance: z.ZodObject<{
        state: z.ZodEnum<{
            FAILED: "FAILED";
            NOT_RUN: "NOT_RUN";
            PASSED: "PASSED";
            INCONCLUSIVE: "INCONCLUSIVE";
        }>;
        evidence: z.ZodString;
        measurements: z.ZodArray<z.ZodObject<{
            target: z.ZodString;
            size: z.ZodEnum<{
                medium: "medium";
                small: "small";
                large: "large";
            }>;
            samplesPerVersion: z.ZodNumber;
            baselineP50Milliseconds: z.ZodNullable<z.ZodNumber>;
            candidateP50Milliseconds: z.ZodNullable<z.ZodNumber>;
            baselineP95Milliseconds: z.ZodNullable<z.ZodNumber>;
            candidateP95Milliseconds: z.ZodNullable<z.ZodNumber>;
            semanticEquivalence: z.ZodEnum<{
                FAILED: "FAILED";
                PASSED: "PASSED";
                NOT_ESTABLISHED: "NOT_ESTABLISHED";
            }>;
        }, z.core.$strict>>;
        limitations: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
    integrations: z.ZodArray<z.ZodObject<{
        agent: z.ZodString;
        configuration: z.ZodEnum<{
            FAILED: "FAILED";
            NOT_RUN: "NOT_RUN";
            PASSED: "PASSED";
            BLOCKED: "BLOCKED";
            NOT_AVAILABLE: "NOT_AVAILABLE";
        }>;
        adapterTests: z.ZodEnum<{
            FAILED: "FAILED";
            NOT_RUN: "NOT_RUN";
            PASSED: "PASSED";
            BLOCKED: "BLOCKED";
            NOT_AVAILABLE: "NOT_AVAILABLE";
        }>;
        subprocess: z.ZodEnum<{
            FAILED: "FAILED";
            NOT_RUN: "NOT_RUN";
            PASSED: "PASSED";
            BLOCKED: "BLOCKED";
            NOT_AVAILABLE: "NOT_AVAILABLE";
        }>;
        liveHost: z.ZodEnum<{
            FAILED: "FAILED";
            NOT_RUN: "NOT_RUN";
            PASSED: "PASSED";
            BLOCKED: "BLOCKED";
            NOT_AVAILABLE: "NOT_AVAILABLE";
        }>;
        evidence: z.ZodString;
    }, z.core.$strict>>;
    publicContracts: z.ZodObject<{
        state: z.ZodEnum<{
            FAILED: "FAILED";
            NOT_RUN: "NOT_RUN";
            PASSED: "PASSED";
            BLOCKED: "BLOCKED";
            NOT_AVAILABLE: "NOT_AVAILABLE";
        }>;
        evidence: z.ZodString;
        intentionalChanges: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
    supplyChainGates: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        state: z.ZodEnum<{
            FAILED: "FAILED";
            NOT_RUN: "NOT_RUN";
            PASSED: "PASSED";
            BLOCKED: "BLOCKED";
            NOT_AVAILABLE: "NOT_AVAILABLE";
        }>;
        evidence: z.ZodString;
        sourceCommit: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    remediationAuthority: z.ZodLiteral<"UNCHANGED_EXACT_HTTPONLY_SAFE_ONLY">;
    blockers: z.ZodArray<z.ZodString>;
    verdict: z.ZodEnum<{
        ALPHA12_NOT_BETA_READY: "ALPHA12_NOT_BETA_READY";
        ALPHA12_BETA_READY_WITH_LIMITATIONS: "ALPHA12_BETA_READY_WITH_LIMITATIONS";
    }>;
}, z.core.$strict>;
export type BetaReadiness = z.infer<typeof betaReadinessSchema>;
/** Cross-field gates supplement the portable JSON Schema. Missing evidence never passes. */
export declare function validateBetaReadiness(value: unknown): BetaReadiness;
//# sourceMappingURL=beta-readiness.d.ts.map