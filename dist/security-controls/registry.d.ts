export type SecurityControlContext = "SQL" | "SHELL" | "FILESYSTEM" | "NETWORK_DESTINATION" | "HTML_BODY" | "HTML_ATTRIBUTE" | "JAVASCRIPT" | "URL" | "REDIRECT_DESTINATION" | "REQUEST_ORIGIN" | "AUTHENTICATION";
export interface SecurityControlDefinition {
    readonly id: string;
    readonly version: string;
    readonly context: SecurityControlContext;
    readonly libraries: readonly string[];
    readonly patterns: readonly string[];
    readonly limitations: readonly string[];
    readonly proofEffect: "PROVES_CONTROL" | "PRESERVES_UNTRUSTEDNESS";
}
export declare const SECURITY_CONTROL_REGISTRY_VERSION = "1.1.0";
export declare const SECURITY_CONTROLS: readonly SecurityControlDefinition[];
export declare function securityControlRegistryFingerprint(): string;
//# sourceMappingURL=registry.d.ts.map