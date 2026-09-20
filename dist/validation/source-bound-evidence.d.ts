import { z } from "zod";
export declare const sourceBoundEvidenceFormatVersion: "1.0.0";
export declare const sourceBoundEvidenceResultSchema: z.ZodEnum<{
    NOT_CHECKED: "NOT_CHECKED";
    NOT_APPLICABLE: "NOT_APPLICABLE";
    PASS: "PASS";
    FAIL: "FAIL";
    SKIPPED_CAPABILITY: "SKIPPED_CAPABILITY";
}>;
export declare const sourceBoundEvidenceSubjectSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        FILE: "FILE";
        REPOSITORY: "REPOSITORY";
        ARTIFACT: "ARTIFACT";
    }>;
    identity: z.ZodString;
    sha256: z.ZodOptional<z.ZodString>;
    bytes: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const sourceBoundEvidenceEnvelopeSchema: z.ZodObject<{
    evidenceFormatVersion: z.ZodLiteral<"1.0.0">;
    evidenceType: z.ZodString;
    repository: z.ZodString;
    sourceCommit: z.ZodString;
    producer: z.ZodObject<{
        name: z.ZodString;
        version: z.ZodString;
    }, z.core.$strict>;
    result: z.ZodEnum<{
        NOT_CHECKED: "NOT_CHECKED";
        NOT_APPLICABLE: "NOT_APPLICABLE";
        PASS: "PASS";
        FAIL: "FAIL";
        SKIPPED_CAPABILITY: "SKIPPED_CAPABILITY";
    }>;
    subject: z.ZodObject<{
        kind: z.ZodEnum<{
            FILE: "FILE";
            REPOSITORY: "REPOSITORY";
            ARTIFACT: "ARTIFACT";
        }>;
        identity: z.ZodString;
        sha256: z.ZodOptional<z.ZodString>;
        bytes: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
    details: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strict>;
export declare const sourceBoundEvidenceReferenceSchema: z.ZodObject<{
    evidenceType: z.ZodString;
    path: z.ZodString;
    sha256: z.ZodString;
    required: z.ZodBoolean;
}, z.core.$strict>;
export declare const sourceBoundEvidenceIndexSchema: z.ZodObject<{
    evidenceFormatVersion: z.ZodLiteral<"1.0.0">;
    repository: z.ZodString;
    sourceCommit: z.ZodString;
    evidence: z.ZodArray<z.ZodObject<{
        evidenceType: z.ZodString;
        path: z.ZodString;
        sha256: z.ZodString;
        required: z.ZodBoolean;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type SourceBoundEvidenceEnvelope = z.infer<typeof sourceBoundEvidenceEnvelopeSchema>;
export type SourceBoundEvidenceIndex = z.infer<typeof sourceBoundEvidenceIndexSchema>;
export interface EvidenceBlob {
    readonly path: string;
    readonly bytes: Uint8Array;
}
export declare function sha256(bytes: Uint8Array): string;
export declare function validateSourceBoundEvidenceSet(indexInput: unknown, blobs: readonly EvidenceBlob[], expected: {
    repository: string;
    sourceCommit: string;
}): ReadonlyMap<string, SourceBoundEvidenceEnvelope>;
export declare function requireReadyEvidence(evidence: ReadonlyMap<string, SourceBoundEvidenceEnvelope>, requiredTypes: readonly string[]): void;
//# sourceMappingURL=source-bound-evidence.d.ts.map