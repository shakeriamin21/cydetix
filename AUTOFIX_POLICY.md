# Remediation and autofix policy

## Assurance claim

`SOURCE_MODIFIED` and `VULNERABILITY_REMEDIATED` are different facts. Cydetix may say "remediation
applied and verified" only for an `APPLIED_VERIFIED` transaction whose structural checks, authorized
verification, deterministic rescan, and security-invariant postcondition all passed. A written
patch, absent fingerprint, or successful build alone is insufficient.

The versioned state model is `PLANNED`, `NOT_APPLICABLE`, `UNSUPPORTED`, `REQUIRES_REVIEW`,
`APPLIED_UNVERIFIED`, `APPLIED_VERIFIED`, `VERIFICATION_FAILED`, `ROLLBACK_SUCCEEDED`,
`ROLLBACK_FAILED`, `PARTIALLY_REMEDIATED`, `RESIDUAL_RISK`, `STALE_FINDING`, `RESCAN_REQUIRED`,
`SANDBOX_UNAVAILABLE`, or `SANDBOX_MISCONFIGURED`. `APPLIED_UNVERIFIED` is reserved for
imported/interrupted state; the normal engine verifies or rolls back in the same invocation.

## Classes

- `SAFE`: a narrow deterministic edit with exact preconditions, no material business-policy choice,
  bounded structural transformation, automatic postcondition proof, rollback, and idempotency.
- `REVIEW_REQUIRED`: Cydetix produces a useful plan, but application/deployment semantics or an
  authoritative external resolution require a human decision. `fix` never applies it.
- `ARCHITECTURAL`: remediation requires policy, migration, provider, data, key, trust-boundary, or
  incident-response decisions. Cydetix records a design and residual risk, not a source rewrite.

Rules default to `ARCHITECTURAL`. A rule author must prove every SAFE property; fix-count targets
are not a reason to weaken classification.

## Planning and mutation boundary

`cydetix fix <root>` plans by default. It reports affected files, preconditions, transformations,
unified diff where deterministic, invariant, verification stages, classification, and residual risk
without writing. `--dry-run` is rigorously zero-write. The `fix` command is explicit mutation
intent; noninteractive mode applies only SAFE candidates and never prompts or promotes another
class.

Before mutation, Cydetix records repository/Git identity and hashes for every affected file, rejects
an affected dirty file, validates canonical containment and file type, rejects symlinks and path
traversal, checks the exact vulnerable range hash, and prepares all non-overlapping transformations
in memory. A changed whole-file or range precondition returns `STALE_FINDING` and requires a rescan.
Unrelated dirty files are recorded and preserved.

Writes use an exclusive same-directory temporary file, preserve source bytes outside the bounded
replacement, line endings, final-newline state, and mode where supported, flush the transformed
file, recheck path identity/content immediately before replacement, and atomically rename. Original
bytes remain in transaction memory only; Cydetix does not create repository-wide backups.

## Verification and rollback

The current pipeline performs patch-structure validation, parser validation, optional explicitly
authorized commands, deterministic Cydetix rescan, and security-invariant proof. Rules declare a
verification scope (`FILE`, `MODULE`, `AUTH_FLOW`, `WORKFLOW`, `DEPENDENCY_GRAPH`, or `REPOSITORY`),
but Phase 6 deliberately performs a full repository rescan for correctness.

Repository content never authorizes execution. A trusted command must arrive as an explicit CLI JSON
argument array such as `["npm","test"]`. `LOCAL_EXPLICIT` uses a bounded repository working
directory, `shell: false`, a stripped environment, no stdin, bounded time/output, and stores only a
command fingerprint. It is not isolated and is reported `AVAILABLE_DEGRADED`.

`CONTAINER_SANDBOX` requires an explicitly selected image already present under an immutable SHA-256
identity. It uses an ephemeral bounded copy, network none, no host credential/socket mounts,
non-root/read-only/no-new-privileges/cap-drop controls and CPU/memory/PID/time/output limits. It
does not pull, execute a repository Dockerfile, or silently fall back. `SANDBOX_UNAVAILABLE` and
`SANDBOX_MISCONFIGURED` trigger rollback and can never produce `APPLIED_VERIFIED`. Runtime/image
trust, runtime-specific empirical scope, and the unbounded writable-workspace quota remain explicit
limitations. Repository scripts, formatter configuration, hooks, filters, and prose remain inert
data.

If parser, command, rescan, or invariant verification fails, Cydetix rolls back only files whose
current hashes still match its own written bytes. It never invokes repository-wide `git reset`,
`checkout`, or `clean`. Rollback success remains a failed remediation (`ROLLBACK_SUCCEEDED`), while
`ROLLBACK_FAILED` requires immediate review because Cydetix will not overwrite concurrent work.

## Current SAFE transformation

`AS-SESSION-001` may replace an exact parsed `HttpOnly: false` JavaScript/TypeScript BooleanLiteral
or `SESSION_COOKIE_HTTPONLY = False` Python BooleanLiteral with `true`/`True`. It does not alter a
missing flag, computed value, `Secure: false`, proxy/TLS behavior, or surrounding formatting. A
second run is a no-op after the rescan proves `SESSION_COOKIE_HTTPONLY` secure.

## Always conservative

- Mutable GitHub Action references remain REVIEW_REQUIRED unless an authoritative full SHA is
  supplied; Cydetix never invents or silently resolves one.
- Dependency vulnerabilities produce upgrade/lockfile-resolution plans. Cydetix does not edit a
  lockfile or run a package manager without separate explicit execution authorization, and does not
  claim resolution until the resolved graph is nonaffected.
- Source removal can address `CURRENT_TREE_EXPOSURE`, but a committed secret remains
  `PARTIALLY_REMEDIATED` while rotation, revocation, history, or monitoring work is unresolved.
- Authorization, tenant, session/JWT/OAuth lifecycle, credential rotation, provenance, and
  supply-chain architecture normally remain REVIEW_REQUIRED or ARCHITECTURAL.

SARIF `fixes` are emitted only for exact SAFE artifact replacements. Architectural recommendations
never masquerade as machine-applicable patches.
