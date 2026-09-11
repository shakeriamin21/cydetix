import { stableObjectFingerprint } from "../core/hash.js";
export const SECURITY_CONTROL_REGISTRY_VERSION = "1.0.0";
export const SECURITY_CONTROLS = [
    {
        id: "SQL-SEPARATE-BIND-PARAMETERS",
        version: "1.0.0",
        context: "SQL",
        libraries: ["pg", "mysql2", "sqlite3", "Python DB-API", "SQLAlchemy"],
        patterns: ["constant SQL text with placeholders and a separate parameter collection"],
        limitations: [
            "Bind parameters protect data values, not table names, column names, sort fragments, or other SQL structure.",
        ],
        proofEffect: "PROVES_CONTROL",
    },
    {
        id: "PROCESS-DIRECT-ARGV",
        version: "1.0.0",
        context: "SHELL",
        libraries: ["node:child_process", "Python subprocess"],
        patterns: ["direct executable with an argument array and shell execution disabled"],
        limitations: [
            "The invoked program can still have argument-injection semantics outside this control.",
        ],
        proofEffect: "PROVES_CONTROL",
    },
    {
        id: "CANONICAL-PATH-CONFINEMENT",
        version: "1.0.0",
        context: "FILESYSTEM",
        libraries: ["node:path", "Python pathlib", "Python os.path"],
        patterns: [
            "canonical candidate plus boundary-aware containment check before the filesystem sink",
        ],
        limitations: [
            "Lexical confinement does not by itself prove resistance to post-check symlink races or platform-specific reparse points.",
        ],
        proofEffect: "PROVES_CONTROL",
    },
    {
        id: "EXPLICIT-NETWORK-DESTINATION-POLICY",
        version: "1.0.0",
        context: "NETWORK_DESTINATION",
        libraries: ["URL", "urllib.parse"],
        patterns: ["parsed URL with exact hostname allowlist and explicit scheme restriction"],
        limitations: [
            "DNS rebinding, redirect destinations, resolved IP ranges, and proxy behavior require separate policy evidence.",
        ],
        proofEffect: "PROVES_CONTROL",
    },
    {
        id: "ENCODING-PRESERVES-TAINT",
        version: "1.0.0",
        context: "NETWORK_DESTINATION",
        libraries: ["JavaScript built-ins", "Python standard library"],
        patterns: ["String conversion or URL component encoding"],
        limitations: ["Encoding does not establish destination authorization."],
        proofEffect: "PRESERVES_UNTRUSTEDNESS",
    },
];
export function securityControlRegistryFingerprint() {
    return stableObjectFingerprint({
        version: SECURITY_CONTROL_REGISTRY_VERSION,
        controls: [...SECURITY_CONTROLS].sort((left, right) => left.id.localeCompare(right.id)),
    });
}
//# sourceMappingURL=registry.js.map