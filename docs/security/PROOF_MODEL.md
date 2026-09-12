# Proof model

A proof-carrying finding explains why Cydetix reached its conclusion. For bounded application
dataflow rules the structured proof contains:

- source and source location;
- ordered propagation path;
- sink and sink location;
- security control encountered and its evaluation;
- reachability;
- violated invariant;
- conclusion and proof state;
- rule ID, version, and maturity;
- CWE, ASVS, and OWASP mappings; and
- analysis limitations.

For example, a supported SQL injection path can establish request input, assignment to a local
value, helper argument/return propagation, dynamic SQL structural interpolation, a reachable
import-proven database sink, and absence of recognized parameterization. The conclusion follows from
that chain; a sink name or regex match alone is insufficient.

## Completeness and UNKNOWN

Each relevant engine reports `COMPLETE`, `PARTIAL`, `UNSUPPORTED`, or `TRUNCATED`. Parser failures,
unresolved dynamic expressions, unknown sanitizer semantics, unsupported syntax, unresolved imports,
and exceeded resource bounds remain visible. If evidence required by an invariant is not
established, Cydetix records `UNKNOWN` or unsupported analysis rather than `PROVEN_SECURE`.

Unknown custom sanitizer-looking functions specifically produce `SANITIZER_UNKNOWN`; their names do
not establish a guarantee. Controls are contextual: SQL parameterization does not prove shell,
filesystem, or URL safety. Batch 2 preserves the same separation: HTML encoding does not prove
JavaScript or redirect-URL safety, a slash prefix does not prove same-origin redirect confinement,
and SameSite alone does not prove a CSRF invariant. A recognized but wrong-context control is
retained in the evidence path as `RECOGNIZED_INEFFECTIVE`.

CSRF proof also carries architecture evidence. An actionable conclusion requires a structurally
resolved state/action mutation, a literal supported route, proven ambient session/cookie
authentication, and absence of a supported route-bound token or origin control. A session identity
assignment establishes a login session; it is not evidence that the login request relied on an
ambient credential. Unresolved handlers, opaque middleware, or uncertain mutation semantics remain
UNKNOWN or outside the declared proof envelope.

## Determinism

Finding, evidence, rule, and manifest ordering is stable. Content-based fingerprints use canonical
JSON with recursively sorted object keys and pre-sorted semantic arrays. Scan IDs and timestamps are
explicitly ephemeral; deterministic-output tests compare security results and stable fingerprints
independently of those fields.

## Verification

Remediation verification reevaluates the security invariant. Removing the original text or sink is
not sufficient for `APPLIED_VERIFIED`; the verifier must establish the required postcondition. If
proof remains incomplete, the transaction reports the appropriate incomplete or residual-risk state
instead of claiming a verified secure transition.
