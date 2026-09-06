# Roadmap

Roadmap entries are possible directions, not implemented capabilities, commitments, or delivery
dates. Current behavior is defined by `SUPPORT_MATRIX.md`, `docs/CLAIMS.md`, and released artifacts.

## Analysis coverage

- Add framework adapters only with explicit API guarantees, vulnerable fixtures, secure negatives,
  false-positive traps, and external validation where feasible.
- Deepen Python semantics beyond syntax/local-rule coverage.
- Evaluate additional authentication, authorization, and tenant-policy patterns without converting
  missing evidence into findings.
- Add dependency-function reachability only where the result can preserve `PROVEN`, `UNKNOWN`, and
  not-applicable distinctions.

## Remediation and policy

- Add SAFE adapters only for deterministic edits whose security invariant and rollback behavior can
  be proven end to end.
- Explore a versioned policy engine for organizational gates, suppressions, and evidence
  requirements without weakening the product defaults.
- Expand enterprise reporting and longitudinal comparison while keeping repository data local by
  default.

## Ecosystems and interoperability

- Evaluate PyPI inventory and advisory support.
- Add import/export adapters for established tools such as Gitleaks, OSV-Scanner, Semgrep, and
  CodeQL without treating them as unquestioned vulnerability truth.
- Evaluate SPDX, VEX, and stronger in-toto/SLSA policy after their exact data relationships can be
  represented honestly.
- Grow external validation corpora and independent adjudication across each claimed rule family.

## Distribution and developer experience

- Consider signed native binaries for Windows, Linux, and macOS after feature parity and
  cross-platform security gates.
- Improve IDE integration and editor-safe review flows.
- Evolve Agent Skills and plugins with current host formats while preserving the deterministic
  engine/agent-reasoning boundary.
- Consider Marketplace distribution only after repository identity, ownership, maintenance, and
  support paths are mature.

## Execution isolation

- Evaluate additional disposable sandbox runtimes and tighter writable-workspace quotas.
- Measure isolation controls on more kernels, container runtimes, host platforms, and reviewed
  immutable images.
- Preserve explicit local authorization and fail-closed behavior; no roadmap work may silently turn
  repository content into execution authority.

## Product principles

- No hidden telemetry.
- No stable-production claim based on prerelease versioning or a single score.
- No broad framework claim without measured evidence.
- No automatic history rewrite, secret validation, or publication.
- Security boundaries and unfavorable validation results remain visible.
