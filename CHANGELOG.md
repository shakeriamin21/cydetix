# Changelog

All notable changes will be documented here. Versions follow Semantic Versioning for the CLI
package; report and rule schemas are versioned independently.

## [Unreleased]

### Changed

- Renamed the public product/package/primary binary from the prior InvariantSec candidate to the
  requested unscoped `vibeshield` identity while retaining the old binary and config filename as
  migration aliases.
- Added zero-config current-project scanning, concise decision-oriented human output, primary `fix`
  and `setup` flows, six agent adapters, and a version-pinned durable MCP setup model.
- Replaced four public specialist skills with one implicitly invocable `vibeshield` skill and added
  `vibeshield_scan`, `vibeshield_fix`, and `vibeshield_explain` as the minimal MCP surface.
- Added trigger-selection, setup/reconfiguration/uninstall, MCP protocol, intent-boundary, and
  packed `npm exec`/global launcher regression coverage.

No publication is authorized. The exact npm name was unregistered when checked on 2026-09-06, but
multiple active VibeShield security-market uses require explicit identity review and no trademark
clearance is claimed.

## [0.6.0-alpha.1] - 2026-09-05

### Security analysis and authentication

- Versioned external corpus manifests, scanner/label separation, manual adjudication records,
  per-rule TP/FP/TN/FN accounting, denominator-aware metrics, and release validation schema.
- Pinned NodeGoat and BenchmarkPython validation results without bundling third-party source.
- Hostile-repository, provider/tool failure, deterministic output, mutation, and terminal-safety
  regression coverage.

### Supply chain

- npm lockfile inventory, explicit OSV states, redacted current/history secret analysis, GitHub
  Actions trust-boundary analysis, and CycloneDX 1.7 output.
- Exact package allowlist, size/lifecycle gates, clean tarball installation, current-tree audit,
  bounded history privacy audit, and independent Gitleaks release gate.

### Remediation and sandbox

- `NO_EXECUTION`, `LOCAL_EXPLICIT`, and immutable-image `CONTAINER_SANDBOX` verification runners
  with explicit capability/control states and no silent fallback.
- Remediation command verification now runs through an explicit provider and rolls back when a
  required container is unavailable or misconfigured.
- Docker verification requires daemon-reported Linux memory/PID/seccomp support and a real hardened
  launch with a locally present SHA-256 image. It applies network, environment, privilege, rootfs,
  resource, timeout, output, and ephemeral-workspace controls without local fallback.
- Thirteen empirical container tests cover the prior five capability gates plus effective controls,
  exhaustion, cleanup, entrypoint clearing, sandboxed SAFE remediation, rollback, redaction, and
  terminal safety.

### Agent integration

- Four portable Agent Skills, a skills-only Codex plugin package, and a composite GitHub Action with
  documented deterministic-engine versus agent-reasoning boundaries.

### Distribution and release security

- Six-case hosted Node/OS CI matrix plus a hosted Linux Docker sandbox job.
- Fail-closed release workflow with exact-commit CI/Scorecard checks, approved identity/private
  reporting gate, annotated tag validation, npm Trusted Publishing through OIDC, `alpha` dist-tag,
  GitHub build/SBOM attestations, draft-first prerelease handling, and full-SHA-pinned Actions.
- SHA-256 checksums, current-source release validation, release manifest, plugin archive, npm
  tarball, CycloneDX SBOM, and reproducible-input metadata generation.
- Public claims, limitations, privacy, incident response, issue forms, naming collision analysis,
  repository-configuration guidance, and release notes.

### Changed

- Optional tool probes and OSV normalization fail closed under hangs, huge/malformed output, partial
  results, transport failures, and sanitized host environments.
- Container workload cleanup retries exact-name removal and absence inspection within a bounded
  window, while still returning `SANDBOX_MISCONFIGURED` if cleanup cannot be proven.
- SAFE remediation dry-runs preserve zero-write planning semantics without returning the
  applied-but-unverified automation exit state.
- Release validation states distinguish executed pass/fail, capability skip, not applicable, and not
  checked rather than counting an unavailable check as passing.

## [0.5.0] - 2026-09-02

### Added

- Remediation report/transaction v1 with explicit lifecycle states, stable finding identity,
  repository/file baselines, unified diffs, verification results, before/after invariant proof,
  rollback state, residual risk, and separate performance timings.
- Conservative remediation planning for every classification, zero-write dry runs, a bounded
  `AS-SESSION-001` SAFE transformation, atomic writes, stale/dirty/path/symlink protection,
  hash-guarded rollback, deterministic rescan, and idempotency.
- Plan-only semantics for vulnerable dependencies, mutable GitHub Actions, secret incident response,
  authorization/authentication policy, and architectural supply-chain work.
- Explicit trusted-command authorization with non-shell bounded execution, `remediation show`, seven
  automation exit states, exact SAFE SARIF fixes, Phase 5 benchmark/validator, and adversarial
  Windows-compatible corpus.

### Changed

- `vibeshield fix` now plans by default and reserves `APPLIED_VERIFIED` for changes whose parser,
  authorized verification, deterministic rescan, intended hashes, and security-invariant
  postcondition all pass.
- The `security-remediation` Agent Skill consumes deterministic classification and proof, cannot
  promote architectural work, and treats successful rollback as failed remediation.
- Product/plugin metadata advances to `0.5.0`; scan report schema v2 remains backward compatible,
  while remediation uses an independent public v1 schema.

## [0.4.0] - 2026-09-02

### Added

- Supply-chain IR and analysis v1 with npm lockfile inventory, Package URLs, dependency paths,
  lifecycle/source/integrity evidence, and explicit OSV provider states.
- Redacted structured secret analysis, explicit bounded Git-history mode, and incident remediation
  semantics that distinguish removal, rotation/revocation, and possible history work.
- GitHub Actions rules for immutable pinning, `write-all`, context-to-shell injection, and
  privileged `pull_request_target` trust chains.
- CycloneDX 1.7 SBOM generation, observable provenance controls, external-tool capability contract,
  supply-chain CLI commands, Phase 4 corpus/performance scripts, and `supply-chain-audit` skill.

### Changed

- Report schema v2 and Security IR v1 accept backward-compatible optional supply-chain data; SARIF
  includes dependency/workflow code flows and redacted secret evidence.
- Product/plugin metadata advances from the verified Phase 3 baseline to `0.4.0`.

## [0.3.0] - 2026-09-02

### Added

- Authentication analysis v1 and authentication graph v2 with source-evidenced session, password
  reset, JWT, refresh-token, OAuth, OIDC, MFA, privilege-change, and reauthentication operation
  types.
- Applicability-aware authentication invariants with `PROVEN_SECURE`, `PROVEN_INSECURE`, and
  `UNKNOWN` conclusions, confidence, standards relationship, correlation, and cross-file evidence.
- Eight authentication rules for session fixation, incomplete logout, reset-session persistence,
  reusable or weak reset credentials, decoded-but-unverified JWT identity, broken OAuth state, and
  applicable missing PKCE.
- Deep, exact-API adapters for express-session, Prisma authentication records, jsonwebtoken, jose,
  oauth4webapi, and Node CSPRNG reset generation.
- `vibeshield graph <root> --auth` text/JSON diagnostics, richer `auth` output, authentication stage
  timings, raw corpus metrics, and a Phase 3 performance regression check.
- Multi-file secure, vulnerable, unknown, refresh-rotation, and false-positive authentication
  fixtures with SARIF code-flow and secret-redaction checks.

### Changed

- Report schema v2 accepts additive optional authentication analysis and stage timings; no report
  schema v3 was required.
- The `authentication-audit` Agent Skill now consumes deterministic invariant and graph output and
  separates engine proof from agent hypothesis.

## [0.2.0] - 2026-09-01

### Added

- Versioned Security IR and a bounded repository-local relative-ESM call graph.
- Narrow Express authentication, identity-trust propagation, and Prisma resource-query adapters.
- Tri-state object-authorization and tenant-isolation proofs with ordered evidence paths.
- `AS-AUTHZ-001` and `AS-TENANT-001` with vulnerable, secure, and false-positive-trap fixtures.
- Scan report schema v2, public Security IR/proof schemas, SARIF `codeFlows`, golden outputs, and a
  repeatable Phase 2 benchmark.

### Changed

- Authentication graph and coverage reporting now project Phase 2 security reasoning facts.
- Product and plugin version advanced to 0.2.0. See the
  [report migration note](docs/migrations/report-v1-to-v2.md).

## [0.1.0] - 2026-08-30

### Added

- Deterministic offline repository discovery and phase-one security engine.
- Five evidence-backed rules with TypeScript/Python vulnerable and secure fixtures.
- Versioned JSON schemas, terminal/JSON/SARIF reporting, accepted-risk workflows, and one verified
  SAFE HttpOnly fix.
- Focused Agent Skills, a Codex skills-only plugin, first-party GitHub Action, pinned CI, and
  attested release workflow.
