import { z } from "zod";
export declare const securityIrVersion: "1.0.0";
export declare const proofStateSchema: z.ZodEnum<{
    UNKNOWN: "UNKNOWN";
    PROVEN: "PROVEN";
    VIOLATED: "VIOLATED";
}>;
export declare const identityTrustSchema: z.ZodEnum<{
    unknown: "unknown";
    "trusted-authenticated": "trusted-authenticated";
    "trusted-constant": "trusted-constant";
    "attacker-controlled": "attacker-controlled";
    derived: "derived";
}>;
export declare const irLocationSchema: z.ZodObject<{
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
export declare const irEvidenceSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<{
        declaration: "declaration";
        import: "import";
        "route-binding": "route-binding";
        call: "call";
        "identity-source": "identity-source";
        "resource-access": "resource-access";
        "authorization-check": "authorization-check";
        "tenant-check": "tenant-check";
    }>;
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
export declare const irModuleSchema: z.ZodObject<{
    id: z.ZodString;
    path: z.ZodString;
    language: z.ZodEnum<{
        javascript: "javascript";
        typescript: "typescript";
    }>;
}, z.core.$strict>;
export declare const irSymbolSchema: z.ZodObject<{
    id: z.ZodString;
    moduleId: z.ZodString;
    name: z.ZodString;
    kind: z.ZodEnum<{
        function: "function";
        import: "import";
        method: "method";
        variable: "variable";
        parameter: "parameter";
    }>;
    exported: z.ZodBoolean;
    parameterNames: z.ZodArray<z.ZodString>;
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
}, z.core.$strict>;
export declare const irRouteSchema: z.ZodObject<{
    id: z.ZodString;
    moduleId: z.ZodString;
    framework: z.ZodEnum<{
        Express: "Express";
    }>;
    method: z.ZodEnum<{
        GET: "GET";
        POST: "POST";
        PUT: "PUT";
        PATCH: "PATCH";
        DELETE: "DELETE";
    }>;
    path: z.ZodString;
    handlerSymbolId: z.ZodOptional<z.ZodString>;
    middlewareSymbolIds: z.ZodArray<z.ZodString>;
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
    evidenceIds: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const irCallArgumentSchema: z.ZodObject<{
    position: z.ZodNumber;
    expression: z.ZodString;
    identityFactIds: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const irCallSchema: z.ZodObject<{
    id: z.ZodString;
    callerSymbolId: z.ZodString;
    calleeName: z.ZodString;
    receiver: z.ZodOptional<z.ZodString>;
    resolution: z.ZodEnum<{
        resolved: "resolved";
        unresolved: "unresolved";
        dynamic: "dynamic";
    }>;
    calleeSymbolId: z.ZodOptional<z.ZodString>;
    arguments: z.ZodArray<z.ZodObject<{
        position: z.ZodNumber;
        expression: z.ZodString;
        identityFactIds: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
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
    evidenceIds: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const identityFactSchema: z.ZodObject<{
    id: z.ZodString;
    symbolId: z.ZodString;
    name: z.ZodString;
    source: z.ZodEnum<{
        unknown: "unknown";
        literal: "literal";
        derived: "derived";
        "authenticated-context": "authenticated-context";
        "request-param": "request-param";
        "request-body": "request-body";
        "request-query": "request-query";
        "request-header": "request-header";
    }>;
    trust: z.ZodEnum<{
        unknown: "unknown";
        "trusted-authenticated": "trusted-authenticated";
        "trusted-constant": "trusted-constant";
        "attacker-controlled": "attacker-controlled";
        derived: "derived";
    }>;
    derivedFrom: z.ZodArray<z.ZodString>;
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
    evidenceIds: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const resourceSelectorSchema: z.ZodObject<{
    field: z.ZodString;
    expression: z.ZodString;
    identityFactId: z.ZodOptional<z.ZodString>;
    trust: z.ZodEnum<{
        unknown: "unknown";
        "trusted-authenticated": "trusted-authenticated";
        "trusted-constant": "trusted-constant";
        "attacker-controlled": "attacker-controlled";
        derived: "derived";
    }>;
}, z.core.$strict>;
export declare const resourceOperationSchema: z.ZodObject<{
    id: z.ZodString;
    functionSymbolId: z.ZodString;
    technology: z.ZodEnum<{
        Prisma: "Prisma";
    }>;
    resourceType: z.ZodString;
    operation: z.ZodEnum<{
        create: "create";
        "read-one": "read-one";
        "read-many": "read-many";
        update: "update";
        delete: "delete";
    }>;
    selectors: z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        expression: z.ZodString;
        identityFactId: z.ZodOptional<z.ZodString>;
        trust: z.ZodEnum<{
            unknown: "unknown";
            "trusted-authenticated": "trusted-authenticated";
            "trusted-constant": "trusted-constant";
            "attacker-controlled": "attacker-controlled";
            derived: "derived";
        }>;
    }, z.core.$strict>>;
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
    evidenceIds: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const enforcementFactSchema: z.ZodObject<{
    id: z.ZodString;
    functionSymbolId: z.ZodString;
    kind: z.ZodEnum<{
        permission: "permission";
        authentication: "authentication";
        role: "role";
        ownership: "ownership";
        tenant: "tenant";
    }>;
    subjectIdentityFactId: z.ZodOptional<z.ZodString>;
    resourceField: z.ZodOptional<z.ZodString>;
    state: z.ZodEnum<{
        UNKNOWN: "UNKNOWN";
        PROVEN: "PROVEN";
        VIOLATED: "VIOLATED";
    }>;
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
    evidenceIds: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const irEdgeSchema: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    kind: z.ZodEnum<{
        imports: "imports";
        exports: "exports";
        "binds-route": "binds-route";
        calls: "calls";
        "passes-identity": "passes-identity";
        "derives-identity": "derives-identity";
        "reads-resource": "reads-resource";
        "writes-resource": "writes-resource";
        "enforces-authorization": "enforces-authorization";
        "enforces-tenant": "enforces-tenant";
    }>;
    evidenceIds: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const securityIrSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"1.0.0">;
    modules: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        path: z.ZodString;
        language: z.ZodEnum<{
            javascript: "javascript";
            typescript: "typescript";
        }>;
    }, z.core.$strict>>;
    symbols: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        moduleId: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<{
            function: "function";
            import: "import";
            method: "method";
            variable: "variable";
            parameter: "parameter";
        }>;
        exported: z.ZodBoolean;
        parameterNames: z.ZodArray<z.ZodString>;
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
    }, z.core.$strict>>;
    routes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        moduleId: z.ZodString;
        framework: z.ZodEnum<{
            Express: "Express";
        }>;
        method: z.ZodEnum<{
            GET: "GET";
            POST: "POST";
            PUT: "PUT";
            PATCH: "PATCH";
            DELETE: "DELETE";
        }>;
        path: z.ZodString;
        handlerSymbolId: z.ZodOptional<z.ZodString>;
        middlewareSymbolIds: z.ZodArray<z.ZodString>;
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
        evidenceIds: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    calls: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        callerSymbolId: z.ZodString;
        calleeName: z.ZodString;
        receiver: z.ZodOptional<z.ZodString>;
        resolution: z.ZodEnum<{
            resolved: "resolved";
            unresolved: "unresolved";
            dynamic: "dynamic";
        }>;
        calleeSymbolId: z.ZodOptional<z.ZodString>;
        arguments: z.ZodArray<z.ZodObject<{
            position: z.ZodNumber;
            expression: z.ZodString;
            identityFactIds: z.ZodArray<z.ZodString>;
        }, z.core.$strict>>;
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
        evidenceIds: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    identities: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        symbolId: z.ZodString;
        name: z.ZodString;
        source: z.ZodEnum<{
            unknown: "unknown";
            literal: "literal";
            derived: "derived";
            "authenticated-context": "authenticated-context";
            "request-param": "request-param";
            "request-body": "request-body";
            "request-query": "request-query";
            "request-header": "request-header";
        }>;
        trust: z.ZodEnum<{
            unknown: "unknown";
            "trusted-authenticated": "trusted-authenticated";
            "trusted-constant": "trusted-constant";
            "attacker-controlled": "attacker-controlled";
            derived: "derived";
        }>;
        derivedFrom: z.ZodArray<z.ZodString>;
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
        evidenceIds: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    resourceOperations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        functionSymbolId: z.ZodString;
        technology: z.ZodEnum<{
            Prisma: "Prisma";
        }>;
        resourceType: z.ZodString;
        operation: z.ZodEnum<{
            create: "create";
            "read-one": "read-one";
            "read-many": "read-many";
            update: "update";
            delete: "delete";
        }>;
        selectors: z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            expression: z.ZodString;
            identityFactId: z.ZodOptional<z.ZodString>;
            trust: z.ZodEnum<{
                unknown: "unknown";
                "trusted-authenticated": "trusted-authenticated";
                "trusted-constant": "trusted-constant";
                "attacker-controlled": "attacker-controlled";
                derived: "derived";
            }>;
        }, z.core.$strict>>;
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
        evidenceIds: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    enforcements: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        functionSymbolId: z.ZodString;
        kind: z.ZodEnum<{
            permission: "permission";
            authentication: "authentication";
            role: "role";
            ownership: "ownership";
            tenant: "tenant";
        }>;
        subjectIdentityFactId: z.ZodOptional<z.ZodString>;
        resourceField: z.ZodOptional<z.ZodString>;
        state: z.ZodEnum<{
            UNKNOWN: "UNKNOWN";
            PROVEN: "PROVEN";
            VIOLATED: "VIOLATED";
        }>;
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
        evidenceIds: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    evidence: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<{
            declaration: "declaration";
            import: "import";
            "route-binding": "route-binding";
            call: "call";
            "identity-source": "identity-source";
            "resource-access": "resource-access";
            "authorization-check": "authorization-check";
            "tenant-check": "tenant-check";
        }>;
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
    edges: z.ZodArray<z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
        kind: z.ZodEnum<{
            imports: "imports";
            exports: "exports";
            "binds-route": "binds-route";
            calls: "calls";
            "passes-identity": "passes-identity";
            "derives-identity": "derives-identity";
            "reads-resource": "reads-resource";
            "writes-resource": "writes-resource";
            "enforces-authorization": "enforces-authorization";
            "enforces-tenant": "enforces-tenant";
        }>;
        evidenceIds: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    supplyChain: z.ZodOptional<z.ZodObject<{
        schemaVersion: z.ZodLiteral<"1.0.0">;
        packages: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ecosystem: z.ZodLiteral<"npm">;
            name: z.ZodString;
            version: z.ZodString;
            purl: z.ZodString;
            kind: z.ZodEnum<{
                direct: "direct";
                dev: "dev";
                optional: "optional";
                peer: "peer";
                transitive: "transitive";
            }>;
            resolved: z.ZodBoolean;
            integrity: z.ZodOptional<z.ZodString>;
            source: z.ZodEnum<{
                registry: "registry";
                git: "git";
                http: "http";
                workspace: "workspace";
                unknown: "unknown";
            }>;
            dev: z.ZodBoolean;
            optional: z.ZodBoolean;
            evidenceIds: z.ZodArray<z.ZodString>;
        }, z.core.$strict>>;
        workflows: z.ZodArray<z.ZodString>;
        actions: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            workflow: z.ZodString;
            job: z.ZodString;
            repository: z.ZodString;
            reference: z.ZodString;
            kind: z.ZodEnum<{
                "external-action": "external-action";
                "reusable-workflow": "reusable-workflow";
                "local-action": "local-action";
                docker: "docker";
            }>;
            pinning: z.ZodEnum<{
                unknown: "unknown";
                "full-sha": "full-sha";
                "short-sha": "short-sha";
                tag: "tag";
                branch: "branch";
                local: "local";
                digest: "digest";
            }>;
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
        }, z.core.$strict>>;
        secrets: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            provider: z.ZodString;
            type: z.ZodString;
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
            redactedPreview: z.ZodString;
            fingerprint: z.ZodString;
            confidence: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
            sourceCategory: z.ZodEnum<{
                "working-tree": "working-tree";
                "git-history": "git-history";
                "external-tool": "external-tool";
            }>;
            historyState: z.ZodEnum<{
                current: "current";
                historical: "historical";
                "not-checked": "not-checked";
            }>;
            rotationGuidance: z.ZodArray<z.ZodEnum<{
                CURRENT_TREE_REMOVAL: "CURRENT_TREE_REMOVAL";
                CREDENTIAL_ROTATION_REQUIRED: "CREDENTIAL_ROTATION_REQUIRED";
                HISTORY_REWRITE_CONSIDER: "HISTORY_REWRITE_CONSIDER";
                PROVIDER_REVOCATION_REQUIRED: "PROVIDER_REVOCATION_REQUIRED";
            }>>;
            validationState: z.ZodLiteral<"PASSIVE_NOT_VALIDATED">;
            engine: z.ZodString;
        }, z.core.$strict>>;
        evidence: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                manifest: "manifest";
                lockfile: "lockfile";
                dependency: "dependency";
                workflow: "workflow";
                "action-reference": "action-reference";
                permission: "permission";
                "workflow-step": "workflow-step";
                "secret-exposure": "secret-exposure";
                history: "history";
                provenance: "provenance";
            }>;
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
            redacted: z.ZodBoolean;
        }, z.core.$strict>>;
        edges: z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            relationship: z.ZodLiteral<"DEPENDS_ON">;
            evidenceIds: z.ZodArray<z.ZodString>;
        }, z.core.$strict>>;
        limitations: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    limitations: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export type ProofState = z.infer<typeof proofStateSchema>;
export type IdentityTrust = z.infer<typeof identityTrustSchema>;
export type IrLocation = z.infer<typeof irLocationSchema>;
export type IrEvidence = z.infer<typeof irEvidenceSchema>;
export type IrModule = z.infer<typeof irModuleSchema>;
export type IrSymbol = z.infer<typeof irSymbolSchema>;
export type IrRoute = z.infer<typeof irRouteSchema>;
export type IrCall = z.infer<typeof irCallSchema>;
export type IdentityFact = z.infer<typeof identityFactSchema>;
export type ResourceOperation = z.infer<typeof resourceOperationSchema>;
export type EnforcementFact = z.infer<typeof enforcementFactSchema>;
export type IrEdge = z.infer<typeof irEdgeSchema>;
export type SecurityIr = z.infer<typeof securityIrSchema>;
export declare function securityIrId(kind: "module" | "symbol" | "route" | "call" | "identity" | "resource" | "enforcement" | "evidence", ...parts: readonly string[]): string;
export declare function emptySecurityIr(limitations?: readonly string[]): SecurityIr;
//# sourceMappingURL=model.d.ts.map