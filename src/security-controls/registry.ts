import { stableObjectFingerprint } from "../core/hash.js";

export type SecurityControlContext =
  | "SQL"
  | "SHELL"
  | "FILESYSTEM"
  | "NETWORK_DESTINATION"
  | "HTML_BODY"
  | "HTML_ATTRIBUTE"
  | "JAVASCRIPT"
  | "URL"
  | "REDIRECT_DESTINATION"
  | "REQUEST_ORIGIN"
  | "AUTHENTICATION";

export interface SecurityControlDefinition {
  readonly id: string;
  readonly version: string;
  readonly context: SecurityControlContext;
  readonly libraries: readonly string[];
  readonly patterns: readonly string[];
  readonly limitations: readonly string[];
  readonly proofEffect: "PROVES_CONTROL" | "PRESERVES_UNTRUSTEDNESS";
}

export const SECURITY_CONTROL_REGISTRY_VERSION = "1.1.0";

export const SECURITY_CONTROLS: readonly SecurityControlDefinition[] = [
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
  {
    id: "HTML_ESCAPE",
    version: "1.0.0",
    context: "HTML_BODY",
    libraries: ["escape-html", "he", "MarkupSafe"],
    patterns: ["contextual HTML text escaping at the output boundary"],
    limitations: [
      "HTML escaping is not proof for JavaScript, CSS, URL scheme, or unquoted attribute contexts.",
    ],
    proofEffect: "PROVES_CONTROL",
  },
  {
    id: "HTML_SANITIZE",
    version: "1.0.0",
    context: "HTML_BODY",
    libraries: ["DOMPurify", "sanitize-html", "Bleach"],
    patterns: ["recognized HTML sanitizer applied directly before raw HTML rendering"],
    limitations: [
      "Sanitizer configuration, version-specific behavior, URL policy, and JavaScript contexts remain outside this control.",
    ],
    proofEffect: "PROVES_CONTROL",
  },
  {
    id: "TRUSTED_HTML_CONSTRUCTION",
    version: "1.0.0",
    context: "HTML_BODY",
    libraries: ["React", "Jinja2"],
    patterns: [
      "React JSX interpolation or Jinja template value binding with framework autoescaping",
    ],
    limitations: [
      "Raw HTML escape hatches, unsafe markup wrappers, and disabled autoescaping are excluded.",
    ],
    proofEffect: "PROVES_CONTROL",
  },
  {
    id: "REDIRECT_DESTINATION_ALLOWLIST",
    version: "1.0.0",
    context: "REDIRECT_DESTINATION",
    libraries: ["URL", "urllib.parse"],
    patterns: ["canonical URL parsing followed by exact hostname membership in a fixed allowlist"],
    limitations: [
      "Encoded destinations, framework normalization, user-info, alternate schemes, and parser differentials require the exact supported pattern.",
    ],
    proofEffect: "PROVES_CONTROL",
  },
  {
    id: "SAME_ORIGIN_REDIRECT_POLICY",
    version: "1.0.0",
    context: "REDIRECT_DESTINATION",
    libraries: ["URL", "urllib.parse"],
    patterns: ["canonical origin equality or an exact enum mapping to fixed destinations"],
    limitations: [
      "A string prefix check, including startsWith('/'), does not prove same-origin behavior for protocol-relative inputs.",
    ],
    proofEffect: "PROVES_CONTROL",
  },
  {
    id: "CSRF_TOKEN_VERIFICATION",
    version: "1.0.0",
    context: "REQUEST_ORIGIN",
    libraries: ["csurf", "csrf-csrf", "Flask-WTF"],
    patterns: [
      "supported middleware or explicit token verification bound to a state-changing route",
    ],
    limitations: [
      "Arbitrary custom middleware names and token-presence checks do not prove verification.",
    ],
    proofEffect: "PROVES_CONTROL",
  },
  {
    id: "ORIGIN_VALIDATION",
    version: "1.0.0",
    context: "REQUEST_ORIGIN",
    libraries: ["URL", "web framework request headers"],
    patterns: [
      "parsed Origin value compared for exact equality or membership in a fixed trusted-origin set",
    ],
    limitations: [
      "Substring, suffix, and prefix comparisons are not accepted as origin validation.",
    ],
    proofEffect: "PROVES_CONTROL",
  },
  {
    id: "NON_AMBIENT_AUTH",
    version: "1.0.0",
    context: "AUTHENTICATION",
    libraries: ["Authorization Bearer", "jsonwebtoken", "jose"],
    patterns: ["explicit Authorization header credential verified on the supported route path"],
    limitations: [
      "A header read alone, an auth-looking name, or a custom verifier does not prove non-ambient authentication.",
    ],
    proofEffect: "PROVES_CONTROL",
  },
] as const;

export function securityControlRegistryFingerprint(): string {
  return stableObjectFingerprint({
    version: SECURITY_CONTROL_REGISTRY_VERSION,
    controls: [...SECURITY_CONTROLS].sort((left, right) => left.id.localeCompare(right.id)),
  });
}
