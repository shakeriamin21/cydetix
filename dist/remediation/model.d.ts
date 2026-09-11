import { z } from "zod";
export declare const remediationSchemaVersion: "1.0.0";
export declare const remediationStateSchema: z.ZodEnum<{
    UNSUPPORTED: "UNSUPPORTED";
    NOT_APPLICABLE: "NOT_APPLICABLE";
    SANDBOX_UNAVAILABLE: "SANDBOX_UNAVAILABLE";
    SANDBOX_MISCONFIGURED: "SANDBOX_MISCONFIGURED";
    PLANNED: "PLANNED";
    REQUIRES_REVIEW: "REQUIRES_REVIEW";
    APPLIED_UNVERIFIED: "APPLIED_UNVERIFIED";
    APPLIED_VERIFIED: "APPLIED_VERIFIED";
    VERIFICATION_FAILED: "VERIFICATION_FAILED";
    ROLLBACK_SUCCEEDED: "ROLLBACK_SUCCEEDED";
    ROLLBACK_FAILED: "ROLLBACK_FAILED";
    PARTIALLY_REMEDIATED: "PARTIALLY_REMEDIATED";
    RESIDUAL_RISK: "RESIDUAL_RISK";
    STALE_FINDING: "STALE_FINDING";
    RESCAN_REQUIRED: "RESCAN_REQUIRED";
}>;
export declare const verificationScopeSchema: z.ZodEnum<{
    FILE: "FILE";
    MODULE: "MODULE";
    AUTH_FLOW: "AUTH_FLOW";
    WORKFLOW: "WORKFLOW";
    DEPENDENCY_GRAPH: "DEPENDENCY_GRAPH";
    REPOSITORY: "REPOSITORY";
}>;
export declare const securityProofConclusionSchema: z.ZodEnum<{
    UNKNOWN: "UNKNOWN";
    NOT_APPLICABLE: "NOT_APPLICABLE";
    PROVEN_SECURE: "PROVEN_SECURE";
    PROVEN_INSECURE: "PROVEN_INSECURE";
}>;
export declare const remediationStepSchema: z.ZodEnum<{
    ARCHITECTURE_CHANGE_REQUIRED: "ARCHITECTURE_CHANGE_REQUIRED";
    SOURCE_REMOVAL: "SOURCE_REMOVAL";
    ROTATION_REQUIRED: "ROTATION_REQUIRED";
    REVOCATION_REQUIRED: "REVOCATION_REQUIRED";
    HISTORY_REVIEW_REQUIRED: "HISTORY_REVIEW_REQUIRED";
    HISTORY_REWRITE_REQUIRED: "HISTORY_REWRITE_REQUIRED";
    MONITORING_REVIEW: "MONITORING_REVIEW";
    DEPENDENCY_UPGRADE_REVIEW: "DEPENDENCY_UPGRADE_REVIEW";
    LOCKFILE_RESOLUTION_REQUIRED: "LOCKFILE_RESOLUTION_REQUIRED";
    ACTION_SHA_RESOLUTION_REQUIRED: "ACTION_SHA_RESOLUTION_REQUIRED";
    BUSINESS_POLICY_REVIEW: "BUSINESS_POLICY_REVIEW";
}>;
export declare const fileBaselineSchema: z.ZodObject<{
    path: z.ZodString;
    sha256: z.ZodString;
    gitState: z.ZodEnum<{
        UNKNOWN: "UNKNOWN";
        CLEAN: "CLEAN";
        DIRTY: "DIRTY";
    }>;
}, z.core.$strict>;
export declare const plannedTransformationSchema: z.ZodObject<{
    id: z.ZodString;
    adapter: z.ZodEnum<{
        "session-http-only-v1": "session-http-only-v1";
        "github-action-pin-plan-v1": "github-action-pin-plan-v1";
        "dependency-upgrade-plan-v1": "dependency-upgrade-plan-v1";
        "secret-incident-plan-v1": "secret-incident-plan-v1";
        "review-plan-v1": "review-plan-v1";
        "architectural-plan-v1": "architectural-plan-v1";
    }>;
    kind: z.ZodEnum<{
        TEXT_REPLACEMENT: "TEXT_REPLACEMENT";
        PLAN_ONLY: "PLAN_ONLY";
    }>;
    path: z.ZodString;
    startOffset: z.ZodOptional<z.ZodNumber>;
    endOffset: z.ZodOptional<z.ZodNumber>;
    expectedTextSha256: z.ZodOptional<z.ZodString>;
    replacement: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    unifiedDiff: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const remediationCandidateSchema: z.ZodObject<{
    planId: z.ZodString;
    findingFingerprint: z.ZodString;
    stableFindingId: z.ZodString;
    ruleId: z.ZodString;
    classification: z.ZodEnum<{
        SAFE: "SAFE";
        REVIEW_REQUIRED: "REVIEW_REQUIRED";
        ARCHITECTURAL: "ARCHITECTURAL";
    }>;
    state: z.ZodEnum<{
        UNSUPPORTED: "UNSUPPORTED";
        NOT_APPLICABLE: "NOT_APPLICABLE";
        SANDBOX_UNAVAILABLE: "SANDBOX_UNAVAILABLE";
        SANDBOX_MISCONFIGURED: "SANDBOX_MISCONFIGURED";
        PLANNED: "PLANNED";
        REQUIRES_REVIEW: "REQUIRES_REVIEW";
        APPLIED_UNVERIFIED: "APPLIED_UNVERIFIED";
        APPLIED_VERIFIED: "APPLIED_VERIFIED";
        VERIFICATION_FAILED: "VERIFICATION_FAILED";
        ROLLBACK_SUCCEEDED: "ROLLBACK_SUCCEEDED";
        ROLLBACK_FAILED: "ROLLBACK_FAILED";
        PARTIALLY_REMEDIATED: "PARTIALLY_REMEDIATED";
        RESIDUAL_RISK: "RESIDUAL_RISK";
        STALE_FINDING: "STALE_FINDING";
        RESCAN_REQUIRED: "RESCAN_REQUIRED";
    }>;
    affectedFiles: z.ZodArray<z.ZodString>;
    fileBaselines: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        sha256: z.ZodString;
        gitState: z.ZodEnum<{
            UNKNOWN: "UNKNOWN";
            CLEAN: "CLEAN";
            DIRTY: "DIRTY";
        }>;
    }, z.core.$strict>>;
    preconditions: z.ZodArray<z.ZodString>;
    transformations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        adapter: z.ZodEnum<{
            "session-http-only-v1": "session-http-only-v1";
            "github-action-pin-plan-v1": "github-action-pin-plan-v1";
            "dependency-upgrade-plan-v1": "dependency-upgrade-plan-v1";
            "secret-incident-plan-v1": "secret-incident-plan-v1";
            "review-plan-v1": "review-plan-v1";
            "architectural-plan-v1": "architectural-plan-v1";
        }>;
        kind: z.ZodEnum<{
            TEXT_REPLACEMENT: "TEXT_REPLACEMENT";
            PLAN_ONLY: "PLAN_ONLY";
        }>;
        path: z.ZodString;
        startOffset: z.ZodOptional<z.ZodNumber>;
        endOffset: z.ZodOptional<z.ZodNumber>;
        expectedTextSha256: z.ZodOptional<z.ZodString>;
        replacement: z.ZodOptional<z.ZodString>;
        description: z.ZodString;
        unifiedDiff: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    expectedSecurityInvariant: z.ZodString;
    verificationStrategy: z.ZodObject<{
        scope: z.ZodEnum<{
            FILE: "FILE";
            MODULE: "MODULE";
            AUTH_FLOW: "AUTH_FLOW";
            WORKFLOW: "WORKFLOW";
            DEPENDENCY_GRAPH: "DEPENDENCY_GRAPH";
            REPOSITORY: "REPOSITORY";
        }>;
        stages: z.ZodArray<z.ZodEnum<{
            PATCH_STRUCTURE: "PATCH_STRUCTURE";
            PARSER: "PARSER";
            TRUSTED_COMMANDS: "TRUSTED_COMMANDS";
            TARGETED_RESCAN: "TARGETED_RESCAN";
            SECURITY_INVARIANT: "SECURITY_INVARIANT";
        }>>;
        externalCommandsAuthorized: z.ZodBoolean;
    }, z.core.$strict>;
    rollbackStrategy: z.ZodString;
    remediationSteps: z.ZodArray<z.ZodEnum<{
        ARCHITECTURE_CHANGE_REQUIRED: "ARCHITECTURE_CHANGE_REQUIRED";
        SOURCE_REMOVAL: "SOURCE_REMOVAL";
        ROTATION_REQUIRED: "ROTATION_REQUIRED";
        REVOCATION_REQUIRED: "REVOCATION_REQUIRED";
        HISTORY_REVIEW_REQUIRED: "HISTORY_REVIEW_REQUIRED";
        HISTORY_REWRITE_REQUIRED: "HISTORY_REWRITE_REQUIRED";
        MONITORING_REVIEW: "MONITORING_REVIEW";
        DEPENDENCY_UPGRADE_REVIEW: "DEPENDENCY_UPGRADE_REVIEW";
        LOCKFILE_RESOLUTION_REQUIRED: "LOCKFILE_RESOLUTION_REQUIRED";
        ACTION_SHA_RESOLUTION_REQUIRED: "ACTION_SHA_RESOLUTION_REQUIRED";
        BUSINESS_POLICY_REVIEW: "BUSINESS_POLICY_REVIEW";
    }>>;
    residualRisk: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const verificationResultSchema: z.ZodObject<{
    stage: z.ZodEnum<{
        PATCH_STRUCTURE: "PATCH_STRUCTURE";
        PARSER: "PARSER";
        TARGETED_RESCAN: "TARGETED_RESCAN";
        SECURITY_INVARIANT: "SECURITY_INVARIANT";
        PRECONDITION: "PRECONDITION";
        TRUSTED_COMMAND: "TRUSTED_COMMAND";
        ROLLBACK: "ROLLBACK";
    }>;
    status: z.ZodEnum<{
        FAILED: "FAILED";
        UNAVAILABLE: "UNAVAILABLE";
        PASSED: "PASSED";
        SKIPPED: "SKIPPED";
        NOT_AUTHORIZED: "NOT_AUTHORIZED";
    }>;
    message: z.ZodString;
    durationMilliseconds: z.ZodNumber;
    commandFingerprint: z.ZodOptional<z.ZodString>;
    execution: z.ZodOptional<z.ZodObject<{
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
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const actualChangeSchema: z.ZodObject<{
    path: z.ZodString;
    beforeSha256: z.ZodString;
    afterSha256: z.ZodString;
    unifiedDiff: z.ZodString;
}, z.core.$strict>;
export declare const findingStateTransitionSchema: z.ZodObject<{
    findingFingerprint: z.ZodString;
    stableFindingId: z.ZodString;
    ruleId: z.ZodString;
    invariant: z.ZodString;
    before: z.ZodEnum<{
        UNKNOWN: "UNKNOWN";
        NOT_APPLICABLE: "NOT_APPLICABLE";
        PROVEN_SECURE: "PROVEN_SECURE";
        PROVEN_INSECURE: "PROVEN_INSECURE";
    }>;
    after: z.ZodEnum<{
        UNKNOWN: "UNKNOWN";
        NOT_APPLICABLE: "NOT_APPLICABLE";
        PROVEN_SECURE: "PROVEN_SECURE";
        PROVEN_INSECURE: "PROVEN_INSECURE";
    }>;
    result: z.ZodEnum<{
        UNKNOWN: "UNKNOWN";
        RESOLVED_VERIFIED: "RESOLVED_VERIFIED";
        UNRESOLVED: "UNRESOLVED";
    }>;
    evidencePaths: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const remediationTransactionSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"1.0.0">;
    transactionId: z.ZodString;
    findingFingerprints: z.ZodArray<z.ZodString>;
    ruleIds: z.ZodArray<z.ZodString>;
    repositoryBaseline: z.ZodObject<{
        identity: z.ZodString;
        gitHead: z.ZodOptional<z.ZodString>;
        changedPaths: z.ZodArray<z.ZodString>;
        files: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            sha256: z.ZodString;
            gitState: z.ZodEnum<{
                UNKNOWN: "UNKNOWN";
                CLEAN: "CLEAN";
                DIRTY: "DIRTY";
            }>;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    classification: z.ZodLiteral<"SAFE">;
    expectedSecurityInvariants: z.ZodArray<z.ZodString>;
    plannedTransformations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        adapter: z.ZodEnum<{
            "session-http-only-v1": "session-http-only-v1";
            "github-action-pin-plan-v1": "github-action-pin-plan-v1";
            "dependency-upgrade-plan-v1": "dependency-upgrade-plan-v1";
            "secret-incident-plan-v1": "secret-incident-plan-v1";
            "review-plan-v1": "review-plan-v1";
            "architectural-plan-v1": "architectural-plan-v1";
        }>;
        kind: z.ZodEnum<{
            TEXT_REPLACEMENT: "TEXT_REPLACEMENT";
            PLAN_ONLY: "PLAN_ONLY";
        }>;
        path: z.ZodString;
        startOffset: z.ZodOptional<z.ZodNumber>;
        endOffset: z.ZodOptional<z.ZodNumber>;
        expectedTextSha256: z.ZodOptional<z.ZodString>;
        replacement: z.ZodOptional<z.ZodString>;
        description: z.ZodString;
        unifiedDiff: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    actualChanges: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        beforeSha256: z.ZodString;
        afterSha256: z.ZodString;
        unifiedDiff: z.ZodString;
    }, z.core.$strict>>;
    verificationResults: z.ZodArray<z.ZodObject<{
        stage: z.ZodEnum<{
            PATCH_STRUCTURE: "PATCH_STRUCTURE";
            PARSER: "PARSER";
            TARGETED_RESCAN: "TARGETED_RESCAN";
            SECURITY_INVARIANT: "SECURITY_INVARIANT";
            PRECONDITION: "PRECONDITION";
            TRUSTED_COMMAND: "TRUSTED_COMMAND";
            ROLLBACK: "ROLLBACK";
        }>;
        status: z.ZodEnum<{
            FAILED: "FAILED";
            UNAVAILABLE: "UNAVAILABLE";
            PASSED: "PASSED";
            SKIPPED: "SKIPPED";
            NOT_AUTHORIZED: "NOT_AUTHORIZED";
        }>;
        message: z.ZodString;
        durationMilliseconds: z.ZodNumber;
        commandFingerprint: z.ZodOptional<z.ZodString>;
        execution: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    findingStateTransitions: z.ZodArray<z.ZodObject<{
        findingFingerprint: z.ZodString;
        stableFindingId: z.ZodString;
        ruleId: z.ZodString;
        invariant: z.ZodString;
        before: z.ZodEnum<{
            UNKNOWN: "UNKNOWN";
            NOT_APPLICABLE: "NOT_APPLICABLE";
            PROVEN_SECURE: "PROVEN_SECURE";
            PROVEN_INSECURE: "PROVEN_INSECURE";
        }>;
        after: z.ZodEnum<{
            UNKNOWN: "UNKNOWN";
            NOT_APPLICABLE: "NOT_APPLICABLE";
            PROVEN_SECURE: "PROVEN_SECURE";
            PROVEN_INSECURE: "PROVEN_INSECURE";
        }>;
        result: z.ZodEnum<{
            UNKNOWN: "UNKNOWN";
            RESOLVED_VERIFIED: "RESOLVED_VERIFIED";
            UNRESOLVED: "UNRESOLVED";
        }>;
        evidencePaths: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    finalState: z.ZodEnum<{
        UNSUPPORTED: "UNSUPPORTED";
        NOT_APPLICABLE: "NOT_APPLICABLE";
        SANDBOX_UNAVAILABLE: "SANDBOX_UNAVAILABLE";
        SANDBOX_MISCONFIGURED: "SANDBOX_MISCONFIGURED";
        PLANNED: "PLANNED";
        REQUIRES_REVIEW: "REQUIRES_REVIEW";
        APPLIED_UNVERIFIED: "APPLIED_UNVERIFIED";
        APPLIED_VERIFIED: "APPLIED_VERIFIED";
        VERIFICATION_FAILED: "VERIFICATION_FAILED";
        ROLLBACK_SUCCEEDED: "ROLLBACK_SUCCEEDED";
        ROLLBACK_FAILED: "ROLLBACK_FAILED";
        PARTIALLY_REMEDIATED: "PARTIALLY_REMEDIATED";
        RESIDUAL_RISK: "RESIDUAL_RISK";
        STALE_FINDING: "STALE_FINDING";
        RESCAN_REQUIRED: "RESCAN_REQUIRED";
    }>;
    residualRisk: z.ZodArray<z.ZodString>;
    startedAt: z.ZodISODateTime;
    completedAt: z.ZodISODateTime;
    performanceMilliseconds: z.ZodObject<{
        planning: z.ZodNumber;
        transformation: z.ZodNumber;
        fileTransaction: z.ZodNumber;
        targetedRescan: z.ZodNumber;
        verification: z.ZodNumber;
    }, z.core.$strict>;
}, z.core.$strict>;
export declare const remediationReportSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"1.0.0">;
    generatedAt: z.ZodISODateTime;
    dryRun: z.ZodBoolean;
    repository: z.ZodObject<{
        identity: z.ZodString;
        gitHead: z.ZodOptional<z.ZodString>;
        changedPaths: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
    findingsConsidered: z.ZodNumber;
    plans: z.ZodArray<z.ZodObject<{
        planId: z.ZodString;
        findingFingerprint: z.ZodString;
        stableFindingId: z.ZodString;
        ruleId: z.ZodString;
        classification: z.ZodEnum<{
            SAFE: "SAFE";
            REVIEW_REQUIRED: "REVIEW_REQUIRED";
            ARCHITECTURAL: "ARCHITECTURAL";
        }>;
        state: z.ZodEnum<{
            UNSUPPORTED: "UNSUPPORTED";
            NOT_APPLICABLE: "NOT_APPLICABLE";
            SANDBOX_UNAVAILABLE: "SANDBOX_UNAVAILABLE";
            SANDBOX_MISCONFIGURED: "SANDBOX_MISCONFIGURED";
            PLANNED: "PLANNED";
            REQUIRES_REVIEW: "REQUIRES_REVIEW";
            APPLIED_UNVERIFIED: "APPLIED_UNVERIFIED";
            APPLIED_VERIFIED: "APPLIED_VERIFIED";
            VERIFICATION_FAILED: "VERIFICATION_FAILED";
            ROLLBACK_SUCCEEDED: "ROLLBACK_SUCCEEDED";
            ROLLBACK_FAILED: "ROLLBACK_FAILED";
            PARTIALLY_REMEDIATED: "PARTIALLY_REMEDIATED";
            RESIDUAL_RISK: "RESIDUAL_RISK";
            STALE_FINDING: "STALE_FINDING";
            RESCAN_REQUIRED: "RESCAN_REQUIRED";
        }>;
        affectedFiles: z.ZodArray<z.ZodString>;
        fileBaselines: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            sha256: z.ZodString;
            gitState: z.ZodEnum<{
                UNKNOWN: "UNKNOWN";
                CLEAN: "CLEAN";
                DIRTY: "DIRTY";
            }>;
        }, z.core.$strict>>;
        preconditions: z.ZodArray<z.ZodString>;
        transformations: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            adapter: z.ZodEnum<{
                "session-http-only-v1": "session-http-only-v1";
                "github-action-pin-plan-v1": "github-action-pin-plan-v1";
                "dependency-upgrade-plan-v1": "dependency-upgrade-plan-v1";
                "secret-incident-plan-v1": "secret-incident-plan-v1";
                "review-plan-v1": "review-plan-v1";
                "architectural-plan-v1": "architectural-plan-v1";
            }>;
            kind: z.ZodEnum<{
                TEXT_REPLACEMENT: "TEXT_REPLACEMENT";
                PLAN_ONLY: "PLAN_ONLY";
            }>;
            path: z.ZodString;
            startOffset: z.ZodOptional<z.ZodNumber>;
            endOffset: z.ZodOptional<z.ZodNumber>;
            expectedTextSha256: z.ZodOptional<z.ZodString>;
            replacement: z.ZodOptional<z.ZodString>;
            description: z.ZodString;
            unifiedDiff: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        expectedSecurityInvariant: z.ZodString;
        verificationStrategy: z.ZodObject<{
            scope: z.ZodEnum<{
                FILE: "FILE";
                MODULE: "MODULE";
                AUTH_FLOW: "AUTH_FLOW";
                WORKFLOW: "WORKFLOW";
                DEPENDENCY_GRAPH: "DEPENDENCY_GRAPH";
                REPOSITORY: "REPOSITORY";
            }>;
            stages: z.ZodArray<z.ZodEnum<{
                PATCH_STRUCTURE: "PATCH_STRUCTURE";
                PARSER: "PARSER";
                TRUSTED_COMMANDS: "TRUSTED_COMMANDS";
                TARGETED_RESCAN: "TARGETED_RESCAN";
                SECURITY_INVARIANT: "SECURITY_INVARIANT";
            }>>;
            externalCommandsAuthorized: z.ZodBoolean;
        }, z.core.$strict>;
        rollbackStrategy: z.ZodString;
        remediationSteps: z.ZodArray<z.ZodEnum<{
            ARCHITECTURE_CHANGE_REQUIRED: "ARCHITECTURE_CHANGE_REQUIRED";
            SOURCE_REMOVAL: "SOURCE_REMOVAL";
            ROTATION_REQUIRED: "ROTATION_REQUIRED";
            REVOCATION_REQUIRED: "REVOCATION_REQUIRED";
            HISTORY_REVIEW_REQUIRED: "HISTORY_REVIEW_REQUIRED";
            HISTORY_REWRITE_REQUIRED: "HISTORY_REWRITE_REQUIRED";
            MONITORING_REVIEW: "MONITORING_REVIEW";
            DEPENDENCY_UPGRADE_REVIEW: "DEPENDENCY_UPGRADE_REVIEW";
            LOCKFILE_RESOLUTION_REQUIRED: "LOCKFILE_RESOLUTION_REQUIRED";
            ACTION_SHA_RESOLUTION_REQUIRED: "ACTION_SHA_RESOLUTION_REQUIRED";
            BUSINESS_POLICY_REVIEW: "BUSINESS_POLICY_REVIEW";
        }>>;
        residualRisk: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    transactions: z.ZodArray<z.ZodObject<{
        schemaVersion: z.ZodLiteral<"1.0.0">;
        transactionId: z.ZodString;
        findingFingerprints: z.ZodArray<z.ZodString>;
        ruleIds: z.ZodArray<z.ZodString>;
        repositoryBaseline: z.ZodObject<{
            identity: z.ZodString;
            gitHead: z.ZodOptional<z.ZodString>;
            changedPaths: z.ZodArray<z.ZodString>;
            files: z.ZodArray<z.ZodObject<{
                path: z.ZodString;
                sha256: z.ZodString;
                gitState: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    CLEAN: "CLEAN";
                    DIRTY: "DIRTY";
                }>;
            }, z.core.$strict>>;
        }, z.core.$strict>;
        classification: z.ZodLiteral<"SAFE">;
        expectedSecurityInvariants: z.ZodArray<z.ZodString>;
        plannedTransformations: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            adapter: z.ZodEnum<{
                "session-http-only-v1": "session-http-only-v1";
                "github-action-pin-plan-v1": "github-action-pin-plan-v1";
                "dependency-upgrade-plan-v1": "dependency-upgrade-plan-v1";
                "secret-incident-plan-v1": "secret-incident-plan-v1";
                "review-plan-v1": "review-plan-v1";
                "architectural-plan-v1": "architectural-plan-v1";
            }>;
            kind: z.ZodEnum<{
                TEXT_REPLACEMENT: "TEXT_REPLACEMENT";
                PLAN_ONLY: "PLAN_ONLY";
            }>;
            path: z.ZodString;
            startOffset: z.ZodOptional<z.ZodNumber>;
            endOffset: z.ZodOptional<z.ZodNumber>;
            expectedTextSha256: z.ZodOptional<z.ZodString>;
            replacement: z.ZodOptional<z.ZodString>;
            description: z.ZodString;
            unifiedDiff: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        actualChanges: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            beforeSha256: z.ZodString;
            afterSha256: z.ZodString;
            unifiedDiff: z.ZodString;
        }, z.core.$strict>>;
        verificationResults: z.ZodArray<z.ZodObject<{
            stage: z.ZodEnum<{
                PATCH_STRUCTURE: "PATCH_STRUCTURE";
                PARSER: "PARSER";
                TARGETED_RESCAN: "TARGETED_RESCAN";
                SECURITY_INVARIANT: "SECURITY_INVARIANT";
                PRECONDITION: "PRECONDITION";
                TRUSTED_COMMAND: "TRUSTED_COMMAND";
                ROLLBACK: "ROLLBACK";
            }>;
            status: z.ZodEnum<{
                FAILED: "FAILED";
                UNAVAILABLE: "UNAVAILABLE";
                PASSED: "PASSED";
                SKIPPED: "SKIPPED";
                NOT_AUTHORIZED: "NOT_AUTHORIZED";
            }>;
            message: z.ZodString;
            durationMilliseconds: z.ZodNumber;
            commandFingerprint: z.ZodOptional<z.ZodString>;
            execution: z.ZodOptional<z.ZodObject<{
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
            }, z.core.$strict>>;
        }, z.core.$strict>>;
        findingStateTransitions: z.ZodArray<z.ZodObject<{
            findingFingerprint: z.ZodString;
            stableFindingId: z.ZodString;
            ruleId: z.ZodString;
            invariant: z.ZodString;
            before: z.ZodEnum<{
                UNKNOWN: "UNKNOWN";
                NOT_APPLICABLE: "NOT_APPLICABLE";
                PROVEN_SECURE: "PROVEN_SECURE";
                PROVEN_INSECURE: "PROVEN_INSECURE";
            }>;
            after: z.ZodEnum<{
                UNKNOWN: "UNKNOWN";
                NOT_APPLICABLE: "NOT_APPLICABLE";
                PROVEN_SECURE: "PROVEN_SECURE";
                PROVEN_INSECURE: "PROVEN_INSECURE";
            }>;
            result: z.ZodEnum<{
                UNKNOWN: "UNKNOWN";
                RESOLVED_VERIFIED: "RESOLVED_VERIFIED";
                UNRESOLVED: "UNRESOLVED";
            }>;
            evidencePaths: z.ZodArray<z.ZodString>;
        }, z.core.$strict>>;
        finalState: z.ZodEnum<{
            UNSUPPORTED: "UNSUPPORTED";
            NOT_APPLICABLE: "NOT_APPLICABLE";
            SANDBOX_UNAVAILABLE: "SANDBOX_UNAVAILABLE";
            SANDBOX_MISCONFIGURED: "SANDBOX_MISCONFIGURED";
            PLANNED: "PLANNED";
            REQUIRES_REVIEW: "REQUIRES_REVIEW";
            APPLIED_UNVERIFIED: "APPLIED_UNVERIFIED";
            APPLIED_VERIFIED: "APPLIED_VERIFIED";
            VERIFICATION_FAILED: "VERIFICATION_FAILED";
            ROLLBACK_SUCCEEDED: "ROLLBACK_SUCCEEDED";
            ROLLBACK_FAILED: "ROLLBACK_FAILED";
            PARTIALLY_REMEDIATED: "PARTIALLY_REMEDIATED";
            RESIDUAL_RISK: "RESIDUAL_RISK";
            STALE_FINDING: "STALE_FINDING";
            RESCAN_REQUIRED: "RESCAN_REQUIRED";
        }>;
        residualRisk: z.ZodArray<z.ZodString>;
        startedAt: z.ZodISODateTime;
        completedAt: z.ZodISODateTime;
        performanceMilliseconds: z.ZodObject<{
            planning: z.ZodNumber;
            transformation: z.ZodNumber;
            fileTransaction: z.ZodNumber;
            targetedRescan: z.ZodNumber;
            verification: z.ZodNumber;
        }, z.core.$strict>;
    }, z.core.$strict>>;
    summary: z.ZodObject<{
        safe: z.ZodNumber;
        reviewRequired: z.ZodNumber;
        architectural: z.ZodNumber;
        applied: z.ZodNumber;
        verified: z.ZodNumber;
        verificationFailed: z.ZodNumber;
        rolledBack: z.ZodNumber;
        residualFindings: z.ZodNumber;
    }, z.core.$strict>;
    limitations: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export type RemediationState = z.infer<typeof remediationStateSchema>;
export type VerificationScope = z.infer<typeof verificationScopeSchema>;
export type PlannedTransformation = z.infer<typeof plannedTransformationSchema>;
export type RemediationCandidate = z.infer<typeof remediationCandidateSchema>;
export type VerificationResult = z.infer<typeof verificationResultSchema>;
export type ActualChange = z.infer<typeof actualChangeSchema>;
export type FindingStateTransition = z.infer<typeof findingStateTransitionSchema>;
export type RemediationTransaction = z.infer<typeof remediationTransactionSchema>;
export type RemediationReport = z.infer<typeof remediationReportSchema>;
//# sourceMappingURL=model.d.ts.map