export type SecurityControlContext = "SQL" | "SHELL" | "FILESYSTEM" | "NETWORK_DESTINATION";
export interface SecurityControlDefinition {
    readonly id: string;
    readonly version: string;
    readonly context: SecurityControlContext;
    readonly libraries: readonly string[];
    readonly patterns: readonly string[];
    readonly limitations: readonly string[];
    readonly proofEffect: "PROVES_CONTROL" | "PRESERVES_UNTRUSTEDNESS";
}
export declare const SECURITY_CONTROL_REGISTRY_VERSION = "1.0.0";
export declare const SECURITY_CONTROLS: readonly SecurityControlDefinition[];
export declare function securityControlRegistryFingerprint(): string;
//# sourceMappingURL=registry.d.ts.map