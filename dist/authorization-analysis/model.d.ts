import { z } from "zod";
export declare const evidencePathStepSchema: z.ZodObject<{
    order: z.ZodNumber;
    kind: z.ZodEnum<{
        dependency: "dependency";
        workflow: "workflow";
        call: "call";
        authentication: "authentication";
        route: "route";
        identity: "identity";
        resource: "resource";
        enforcement: "enforcement";
        credential: "credential";
        session: "session";
        token: "token";
        oauth: "oauth";
        validation: "validation";
        revocation: "revocation";
        "password-reset": "password-reset";
        advisory: "advisory";
        secret: "secret";
    }>;
    irId: z.ZodString;
    location: z.ZodObject<{
        path: z.ZodString;
        start: z.ZodObject<{
            line: z.ZodNumber;
            column: z.ZodNumber;
            offset: z.ZodNumber;
        }, z.core.$strict>;
        end: z.ZodObject<{
            line: z.ZodNumber;
            column: z.ZodNumber;
            offset: z.ZodNumber;
        }, z.core.$strict>;
    }, z.core.$strict>;
    message: z.ZodString;
}, z.core.$strict>;
export declare const authorizationProofSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"1.0.0">;
    id: z.ZodString;
    invariant: z.ZodEnum<{
        "object-authorization": "object-authorization";
        "tenant-isolation": "tenant-isolation";
    }>;
    state: z.ZodEnum<{
        UNKNOWN: "UNKNOWN";
        PROVEN: "PROVEN";
        VIOLATED: "VIOLATED";
    }>;
    routeId: z.ZodString;
    resourceOperationId: z.ZodString;
    subjectIdentityFactIds: z.ZodArray<z.ZodString>;
    evidencePath: z.ZodArray<z.ZodObject<{
        order: z.ZodNumber;
        kind: z.ZodEnum<{
            dependency: "dependency";
            workflow: "workflow";
            call: "call";
            authentication: "authentication";
            route: "route";
            identity: "identity";
            resource: "resource";
            enforcement: "enforcement";
            credential: "credential";
            session: "session";
            token: "token";
            oauth: "oauth";
            validation: "validation";
            revocation: "revocation";
            "password-reset": "password-reset";
            advisory: "advisory";
            secret: "secret";
        }>;
        irId: z.ZodString;
        location: z.ZodObject<{
            path: z.ZodString;
            start: z.ZodObject<{
                line: z.ZodNumber;
                column: z.ZodNumber;
                offset: z.ZodNumber;
            }, z.core.$strict>;
            end: z.ZodObject<{
                line: z.ZodNumber;
                column: z.ZodNumber;
                offset: z.ZodNumber;
            }, z.core.$strict>;
        }, z.core.$strict>;
        message: z.ZodString;
    }, z.core.$strict>>;
    explanation: z.ZodString;
    confidence: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    reachability: z.ZodEnum<{
        unknown: "unknown";
        unlikely: "unlikely";
        possible: "possible";
        likely: "likely";
        confirmed: "confirmed";
    }>;
}, z.core.$strict>;
export type AuthorizationProof = z.infer<typeof authorizationProofSchema>;
export type EvidencePathStep = z.infer<typeof evidencePathStepSchema>;
//# sourceMappingURL=model.d.ts.map