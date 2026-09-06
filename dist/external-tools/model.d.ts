import { z } from "zod";
export declare const externalToolStatusSchema: z.ZodEnum<{
    FAILED: "FAILED";
    NOT_REQUESTED: "NOT_REQUESTED";
    AVAILABLE: "AVAILABLE";
    UNAVAILABLE: "UNAVAILABLE";
    TIMED_OUT: "TIMED_OUT";
    INVALID_OUTPUT: "INVALID_OUTPUT";
}>;
export declare const externalToolCapabilitySchema: z.ZodObject<{
    adapter: z.ZodString;
    executable: z.ZodString;
    status: z.ZodEnum<{
        FAILED: "FAILED";
        NOT_REQUESTED: "NOT_REQUESTED";
        AVAILABLE: "AVAILABLE";
        UNAVAILABLE: "UNAVAILABLE";
        TIMED_OUT: "TIMED_OUT";
        INVALID_OUTPUT: "INVALID_OUTPUT";
    }>;
    version: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
}, z.core.$strict>;
export type ExternalToolCapability = z.infer<typeof externalToolCapabilitySchema>;
export interface ExternalToolAdapter<TRequest, TResult> {
    readonly name: string;
    readonly executable: string;
    readonly versionArguments: readonly string[];
    probe(): ExternalToolCapability;
    run(request: TRequest): Promise<TResult>;
}
export declare function probeExternalTool(adapter: string, executable: string, versionArguments?: readonly string[]): ExternalToolCapability;
//# sourceMappingURL=model.d.ts.map