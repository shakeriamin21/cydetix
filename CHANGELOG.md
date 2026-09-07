# Changelog

All notable changes will be documented here. Versions follow Semantic Versioning for the CLI
package; report and rule schemas are versioned independently.

## [Unreleased]

## [0.6.0-alpha.5] - 2026-09-07

### Changed

- Prepared `0.6.0-alpha.5` after the immutable alpha.4 release attempt completed every verification,
  artifact, checksum, provenance, SBOM-attestation, and draft-prerelease gate but stopped before npm
  publication.
- Made npm publication require exactly one downloaded `.tgz` and pass it as a quoted explicit local
  package spec beginning with `./`; this prevents npm from parsing `release-bundle/...` as GitHub
  shorthand while preserving public access, the `alpha` dist-tag, ignored lifecycle scripts, and
  direct OIDC publication.
- Extended workflow-security validation and regression coverage to reject the former ambiguous
  package spec, a missing `./`, directory publication, missing `--ignore-scripts`, or a weakened
  single-tarball check.

The `v0.6.0-alpha.4` tag remains fixed at `a7faa9ae085e553334e196a4cdbe5153fbceb1f9`. Release run
`34098600275` failed before registry authentication because npm interpreted the relative tarball
path as a GitHub repository shorthand. No alpha.4 npm publication occurred, and its draft GitHub
prerelease remained non-public because the finalization step was skipped.

## [0.6.0-alpha.4] - 2026-09-07

### Changed

- Prepared `0.6.0-alpha.4` after the immutable alpha.3 release attempt passed its preceding release
  gates but stopped at Git-history privacy enforcement before npm publication.
- Replaced the release privacy audit's implicit all-ref traversal with a required, explicit history
  scope. Release mode resolves the validated tag to one commit and audits that commit plus every
  reachable ancestor; the distinct `--all` mode remains available for repository-wide maintainer
  audits.
- Kept approved author-email fingerprint checks and forbidden path/name checks fail-closed, added
  deterministic scope evidence, and added regression repositories proving that unrelated branches
  are excluded until their commits become reachable through a merge.
- Made workflow-security validation require the tag-scoped privacy command while leaving the
  independent Gitleaks full-history scan unchanged.

The `v0.6.0-alpha.3` tag remains fixed at `7aa5007332b4f961b2812d739abd638fba6645cf`. Release run
`34093517082` failed before npm publication because the old all-ref privacy scope included an
unrelated Dependabot branch commit. The alpha.2 and alpha.3 attempts were not published and are not
reused by this candidate.

## [0.6.0-alpha.3] - 2026-09-06

### Changed

- Prepared `0.6.0-alpha.3` as the replacement candidate after the tagged alpha.2 GitHub Actions
  attempt stopped at `validate:publication-config` before npm publication.
- Synchronized the package, lockfile, CLI version, Codex plugin, pinned skill/MCP launchers, tests,
  release notes, and publication metadata at `0.6.0-alpha.3` without changing security-engine,
  remediation, sandbox, or reporting behavior.
- Recorded the maintainer-provided state that npm Trusted Publishing and GitHub private
  vulnerability reporting are configured, while retaining the fail-closed name-review gate.
- Restored hosted Unix Microsoft SARIF Multitool execution after script-disabled installs by
  validating the package-owned native launcher before restoring only its missing user execute bit;
  Multitool validation remains mandatory, bounded, non-shell, and fail-closed.
- Made the hosted sandbox use the same repository-qualified immutable Node digest it pulls, accepted
  only Docker's semantically equivalent empty-entrypoint and no-new-privileges inspect forms, and
  added control-specific redacted probe diagnostics and regression coverage. Composite Docker test
  cases now have outer harness deadlines that encompass their unchanged bounded operations.

The npm registry still contains only `cydetix@0.6.0-alpha.1`; alpha.2 was not published. Package
registration and release preparation do not establish product-name exclusivity or trademark
clearance, and neither is claimed.

## [0.6.0-alpha.2] - 2026-09-06

The tagged GitHub Actions attempt for this version failed at `validate:publication-config` before
npm publication. This version was not published to npm and is superseded by `0.6.0-alpha.3`.

### Changed

- Finalized the product/package/primary binary as the unscoped Cydetix / `cydetix` identity and
  removed all pre-release candidate aliases and config names.
- Added scan-first zero-config current-project UX, concise decision output, post-scan agent
  discovery with one consent prompt, explicit setup status/verify/remove modes, six adapters, and a
  version-pinned durable MCP model.
- Replaced four public specialist skills with one implicitly invocable `cydetix` skill and added
  `cydetix_scan`, `cydetix_fix`, and `cydetix_explain` as the minimal MCP surface.
- Added trigger-selection, setup/reconfiguration/removal, transactional config validation/rollback,
  MCP protocol, intent-boundary, and packed `npm exec`/global launcher regression coverage.
- Aligned package, CLI, plugin, pinned integration, repository, and release-candidate metadata at
  `0.6.0-alpha.2` after `cydetix@0.6.0-alpha.1` became available on npm.
- Made release-report validation fail closed when evidence names a different package version, and
  removed a stale tracked alpha.1 tarball from the public source tree.

The existing npm package does not establish product-name exclusivity or trademark clearance. No such
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

- `cydetix fix` now plans by default and reserves `APPLIED_VERIFIED` for changes whose parser,
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
- `cydetix graph <root> --auth` text/JSON diagnostics, richer `auth` output, authentication stage
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
