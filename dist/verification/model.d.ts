import { z } from "zod";
export declare const verificationRunnerSchemaVersion: "1.0.0";
export declare const verificationRunnerKindSchema: z.ZodEnum<{
    NO_EXECUTION: "NO_EXECUTION";
    LOCAL_EXPLICIT: "LOCAL_EXPLICIT";
    CONTAINER_SANDBOX: "CONTAINER_SANDBOX";
}>;
export declare const sandboxCapabilityStateSchema: z.ZodEnum<{
    UNAVAILABLE: "UNAVAILABLE";
    AVAILABLE_HARDENED: "AVAILABLE_HARDENED";
    AVAILABLE_DEGRADED: "AVAILABLE_DEGRADED";
    MISCONFIGURED: "MISCONFIGURED";
}>;
export declare const verificationExecutionStateSchema: z.ZodEnum<{
    TIMED_OUT: "TIMED_OUT";
    NOT_RUN: "NOT_RUN";
    SUCCEEDED: "SUCCEEDED";
    COMMAND_FAILED: "COMMAND_FAILED";
    OUTPUT_LIMIT_EXCEEDED: "OUTPUT_LIMIT_EXCEEDED";
    SANDBOX_UNAVAILABLE: "SANDBOX_UNAVAILABLE";
    SANDBOX_MISCONFIGURED: "SANDBOX_MISCONFIGURED";
    WORKSPACE_FAILED: "WORKSPACE_FAILED";
}>;
export declare const networkPolicySchema: z.ZodEnum<{
    DENIED: "DENIED";
    ALLOWED_EXPLICIT: "ALLOWED_EXPLICIT";
}>;
export declare const verificationCommandSchema: z.ZodObject<{
    executable: z.ZodString;
    arguments: z.ZodArray<z.ZodString>;
    workingDirectory: z.ZodDefault<z.ZodString>;
    timeoutMilliseconds: z.ZodDefault<z.ZodNumber>;
    networkPolicy: z.ZodDefault<z.ZodEnum<{
        DENIED: "DENIED";
        ALLOWED_EXPLICIT: "ALLOWED_EXPLICIT";
    }>>;
}, z.core.$strict>;
export declare const sandboxControlsSchema: z.ZodObject<{
    network: z.ZodEnum<{
        DENIED: "DENIED";
        ALLOWED_EXPLICIT: "ALLOWED_EXPLICIT";
        NOT_ISOLATED: "NOT_ISOLATED";
    }>;
    environment: z.ZodEnum<{
        SANITIZED: "SANITIZED";
        HOST_INHERITED: "HOST_INHERITED";
    }>;
    workspace: z.ZodEnum<{
        EPHEMERAL_COPY: "EPHEMERAL_COPY";
        PRIMARY_REPOSITORY: "PRIMARY_REPOSITORY";
    }>;
    containerRoot: z.ZodEnum<{
        NOT_APPLICABLE: "NOT_APPLICABLE";
        READ_ONLY: "READ_ONLY";
        WRITABLE: "WRITABLE";
    }>;
    dockerSocketMounted: z.ZodBoolean;
    sshAgentMounted: z.ZodBoolean;
    privileged: z.ZodBoolean;
    nonRoot: z.ZodBoolean;
    noNewPrivileges: z.ZodBoolean;
    capabilitiesDropped: z.ZodBoolean;
    seccomp: z.ZodEnum<{
        NOT_APPLICABLE: "NOT_APPLICABLE";
        UNAVAILABLE: "UNAVAILABLE";
        RUNTIME_DEFAULT: "RUNTIME_DEFAULT";
        CUSTOM: "CUSTOM";
    }>;
    memoryMegabytes: z.ZodOptional<z.ZodNumber>;
    cpuCount: z.ZodOptional<z.ZodNumber>;
    pidLimit: z.ZodOptional<z.ZodNumber>;
    outputBytes: z.ZodNumber;
    timeoutMilliseconds: z.ZodNumber;
}, z.core.$strict>;
export declare const sandboxCapabilitySchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"1.0.0">;
    runner: z.ZodEnum<{
        NO_EXECUTION: "NO_EXECUTION";
        LOCAL_EXPLICIT: "LOCAL_EXPLICIT";
        CONTAINER_SANDBOX: "CONTAINER_SANDBOX";
    }>;
    state: z.ZodEnum<{
        UNAVAILABLE: "UNAVAILABLE";
        AVAILABLE_HARDENED: "AVAILABLE_HARDENED";
        AVAILABLE_DEGRADED: "AVAILABLE_DEGRADED";
        MISCONFIGURED: "MISCONFIGURED";
    }>;
    runtime: z.ZodString;
    runtimeVersion: z.ZodOptional<z.ZodString>;
    imageIdentity: z.ZodOptional<z.ZodString>;
    controls: z.ZodObject<{
        network: z.ZodEnum<{
            DENIED: "DENIED";
            ALLOWED_EXPLICIT: "ALLOWED_EXPLICIT";
            NOT_ISOLATED: "NOT_ISOLATED";
        }>;
        environment: z.ZodEnum<{
            SANITIZED: "SANITIZED";
            HOST_INHERITED: "HOST_INHERITED";
        }>;
        workspace: z.ZodEnum<{
            EPHEMERAL_COPY: "EPHEMERAL_COPY";
            PRIMARY_REPOSITORY: "PRIMARY_REPOSITORY";
        }>;
        containerRoot: z.ZodEnum<{
            NOT_APPLICABLE: "NOT_APPLICABLE";
            READ_ONLY: "READ_ONLY";
            WRITABLE: "WRITABLE";
        }>;
        dockerSocketMounted: z.ZodBoolean;
        sshAgentMounted: z.ZodBoolean;
        privileged: z.ZodBoolean;
        nonRoot: z.ZodBoolean;
        noNewPrivileges: z.ZodBoolean;
        capabilitiesDropped: z.ZodBoolean;
        seccomp: z.ZodEnum<{
            NOT_APPLICABLE: "NOT_APPLICABLE";
            UNAVAILABLE: "UNAVAILABLE";
            RUNTIME_DEFAULT: "RUNTIME_DEFAULT";
            CUSTOM: "CUSTOM";
        }>;
        memoryMegabytes: z.ZodOptional<z.ZodNumber>;
        cpuCount: z.ZodOptional<z.ZodNumber>;
        pidLimit: z.ZodOptional<z.ZodNumber>;
        outputBytes: z.ZodNumber;
        timeoutMilliseconds: z.ZodNumber;
    }, z.core.$strict>;
    limitations: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const verificationExecutionResultSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"1.0.0">;
    runner: z.ZodEnum<{
        NO_EXECUTION: "NO_EXECUTION";
        LOCAL_EXPLICIT: "LOCAL_EXPLICIT";
        CONTAINER_SANDBOX: "CONTAINER_SANDBOX";
    }>;
    state: z.ZodEnum<{
        TIMED_OUT: "TIMED_OUT";
        NOT_RUN: "NOT_RUN";
        SUCCEEDED: "SUCCEEDED";
        COMMAND_FAILED: "COMMAND_FAILED";
        OUTPUT_LIMIT_EXCEEDED: "OUTPUT_LIMIT_EXCEEDED";
        SANDBOX_UNAVAILABLE: "SANDBOX_UNAVAILABLE";
        SANDBOX_MISCONFIGURED: "SANDBOX_MISCONFIGURED";
        WORKSPACE_FAILED: "WORKSPACE_FAILED";
    }>;
    commandFingerprint: z.ZodString;
    exitCode: z.ZodNullable<z.ZodNumber>;
    durationMilliseconds: z.ZodNumber;
    stdoutBytes: z.ZodNumber;
    stderrBytes: z.ZodNumber;
    outputTruncated: z.ZodBoolean;
    capability: z.ZodObject<{
        schemaVersion: z.ZodLiteral<"1.0.0">;
        runner: z.ZodEnum<{
            NO_EXECUTION: "NO_EXECUTION";
            LOCAL_EXPLICIT: "LOCAL_EXPLICIT";
            CONTAINER_SANDBOX: "CONTAINER_SANDBOX";
        }>;
        state: z.ZodEnum<{
            UNAVAILABLE: "UNAVAILABLE";
            AVAILABLE_HARDENED: "AVAILABLE_HARDENED";
            AVAILABLE_DEGRADED: "AVAILABLE_DEGRADED";
            MISCONFIGURED: "MISCONFIGURED";
        }>;
        runtime: z.ZodString;
        runtimeVersion: z.ZodOptional<z.ZodString>;
        imageIdentity: z.ZodOptional<z.ZodString>;
        controls: z.ZodObject<{
            network: z.ZodEnum<{
                DENIED: "DENIED";
                ALLOWED_EXPLICIT: "ALLOWED_EXPLICIT";
                NOT_ISOLATED: "NOT_ISOLATED";
            }>;
            environment: z.ZodEnum<{
                SANITIZED: "SANITIZED";
                HOST_INHERITED: "HOST_INHERITED";
            }>;
            workspace: z.ZodEnum<{
                EPHEMERAL_COPY: "EPHEMERAL_COPY";
                PRIMARY_REPOSITORY: "PRIMARY_REPOSITORY";
            }>;
            containerRoot: z.ZodEnum<{
                NOT_APPLICABLE: "NOT_APPLICABLE";
                READ_ONLY: "READ_ONLY";
                WRITABLE: "WRITABLE";
            }>;
            dockerSocketMounted: z.ZodBoolean;
            sshAgentMounted: z.ZodBoolean;
            privileged: z.ZodBoolean;
            nonRoot: z.ZodBoolean;
            noNewPrivileges: z.ZodBoolean;
            capabilitiesDropped: z.ZodBoolean;
            seccomp: z.ZodEnum<{
                NOT_APPLICABLE: "NOT_APPLICABLE";
                UNAVAILABLE: "UNAVAILABLE";
                RUNTIME_DEFAULT: "RUNTIME_DEFAULT";
                CUSTOM: "CUSTOM";
            }>;
            memoryMegabytes: z.ZodOptional<z.ZodNumber>;
            cpuCount: z.ZodOptional<z.ZodNumber>;
            pidLimit: z.ZodOptional<z.ZodNumber>;
            outputBytes: z.ZodNumber;
            timeoutMilliseconds: z.ZodNumber;
        }, z.core.$strict>;
        limitations: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
    message: z.ZodString;
}, z.core.$strict>;
export type VerificationCommand = z.infer<typeof verificationCommandSchema>;
export type SandboxControls = z.infer<typeof sandboxControlsSchema>;
export type SandboxCapability = z.infer<typeof sandboxCapabilitySchema>;
export type VerificationExecutionResult = z.infer<typeof verificationExecutionResultSchema>;
//# sourceMappingURL=model.d.ts.map