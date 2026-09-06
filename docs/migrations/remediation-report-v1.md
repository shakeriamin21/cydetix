# Remediation report v1

Phase 5 does not change scan report schema v2. Remediation planning and transactions use a separate
`remediation-report` schema version `1.0.0`, published as `schemas/remediation-report.schema.json`.

This separation is deliberate: read-only scan consumers are not required to understand mutation,
rollback, command authorization, or transaction state. A remediation report references findings by
the original exact fingerprint and a line-number-independent stable identity.

## Top-level contract

- `repository`: portable identity, optional Git HEAD, and changed repository-relative paths.
- `plans`: correlated candidates with class, state, affected files/hashes, preconditions,
  transformations, invariant, verification strategy, rollback strategy, steps, and residual risk.
- `transactions`: SAFE apply attempts with baseline, actual changes, verification results,
  before/after finding state transitions, explicit final state, timings, and residual risk.
- `summary`: considered, classified, applied, verified, failed, rolled-back, and residual counts.
- `limitations`: explicit engine coverage statements.

The schema intentionally excludes a portable `fixed: true` boolean. Only a transaction with
`finalState: "APPLIED_VERIFIED"` and a `RESOLVED_VERIFIED` invariant transition represents verified
remediation. `ROLLBACK_SUCCEEDED` means the attempted remediation failed and source was restored.

## Compatibility and confidentiality

All paths are repository-relative. The report omits the machine-specific absolute root, source
backups, command arguments/output, ambient environment, and raw secret values. Exact SAFE changes
are represented as unified diffs with secret ranges redacted.

Consumers should reject unknown schema versions and use the public JSON Schema rather than infer
meaning from terminal text. `invariantsec remediation show <report>` performs this validation for a
user-controlled report file.
