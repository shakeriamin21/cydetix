# Trust model

Cydetix is a deterministic security authority. AI agents may select its tools and explain its
structured evidence, but may not decide vulnerability truth, sanitizer sufficiency, authorization
policy, or remediation safety.

## Independent axes

A finding preserves separate values for severity, proof state, confidence, reachability, remediation
class, verification strength, and analysis completeness. Severity never grants mutation permission.
A high-severity issue may still be `REVIEW_REQUIRED` or `ARCHITECTURAL`.

Proof states distinguish `PROVEN_INSECURE`, `PROVEN_SECURE`, `UNKNOWN`, and `NOT_APPLICABLE`.
Relevant engine completeness is reported as `COMPLETE`, `PARTIAL`, `UNSUPPORTED`, or `TRUNCATED`.
Incomplete evidence cannot become proof of security.

## Runtime truth

`cydetix rules --format json` reports the exact runtime catalogue: IDs, versions, maturity,
standards, supported ecosystems, and remediation ceilings. `cydetix trust --format json` reports the
catalogue and security-control fingerprints, maturity counts, actual analysis engines, proof
capabilities, SAFE adapters, verification strategies, resource bounds, and explicit limitations.

Each structured scan includes a reproducibility manifest with the Cydetix version, stable catalogue,
configuration and suppression fingerprints, enabled rules, canonical root, passive Git identity,
language/framework and dependency context, advisory mode, scan identity, timestamp, schema version,
and overall completeness. Arrays used by fingerprints are stably ordered.

## Hostile repositories

Repository files are untrusted data. Ordinary analysis is static and never executes package scripts,
hooks, tests, builds, Makefiles, framework CLIs, migrations, formatters, or application code.
Traversal is canonical, bounded, does not follow symlinks, and remains within the selected root.
Embedded instructions cannot change Cydetix policy, select another root, or raise remediation
authority.

## Suppression truth

A suppression identifies rule, optional finding fingerprint, scope, reason, owner, creation date,
and optional expiry. The suppressed finding retains its original proof state and remains
semantically insecure; suppression only removes it from active policy output. Expired suppressions
do not apply. The complete configured suppression set contributes to a stable fingerprint.

## Limits of trust

The Batch 1 engine is deliberately bounded and local. It does not claim whole-program proof,
cross-file application dataflow, Python interprocedural propagation, arbitrary custom sanitizer
semantics, or complete DNS/redirect/symlink-race reasoning. These limits are emitted by `trust` and
scan coverage rather than hidden behind a clean result.
