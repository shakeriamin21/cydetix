# Known limitations

Cydetix is a prerelease static-analysis project, not a guarantee that an application is secure or
compliant.

## Analysis scope

- Cross-file application reasoning is limited to statically named relative ESM imports, literal
  Express routes, direct/namespace calls, narrow supported authentication APIs, and flat Prisma
  selectors.
- CommonJS, path aliases, barrels, dependency injection, callbacks, computed dispatch, arbitrary
  template engines, runtime sanitizer configuration, complex router composition, encoded redirect
  destinations, deployment topology, and most Python cross-file semantics are unsupported or
  unknown. Supported Flask route decorators are modeled only inside their documented local Batch 2
  envelope.
- OIDC, MFA, reauthentication, session lifetime, external-provider internals, account-enumeration
  timing, and refresh-token sender constraint have graph infrastructure or limited proof only.
- npm package-lock v2/v3 is the only resolved dependency ecosystem. Dependency presence does not
  prove vulnerable-function reachability. PyPI and SPDX output are not implemented.
- Secret detection is passive and intentionally narrow. Credentials are never actively validated.
  Removing source does not prove rotation, revocation, monitoring, or history remediation.
- Gitleaks, OSV-Scanner, Semgrep, CodeQL, Scorecard, and Cosign are not imported as finding or proof
  authorities. Some are capability probes only.

## Remediation and execution

- Exactly one SAFE adapter exists: explicit false `HttpOnly` session-cookie configuration.
- Action pinning, dependency upgrades, authorization, session/JWT/OAuth lifecycle changes,
  credential incidents, history rewriting, and provenance design remain review-required or
  architectural.
- Verification scopes are declared, but the current implementation uses a correctness-first full
  rescan rather than dependency-aware incremental invalidation.
- Local explicit commands are not sandboxed. The container provider requires Docker plus an
  immutable local image and supports network-denied execution only.
- Phase 6B empirically validated the hardened profile on Docker Desktop 4.52.0 / Engine 29.0.1,
  WSL2, Linux/amd64, and one Node 22.18 Alpine image. Results do not automatically transfer to a
  different runtime, kernel, image, platform, or daemon configuration.
- The capability launch probe requires `/bin/true` in the explicitly trusted image. Image-defined
  baseline environment variables remain present; arbitrary host variables are not forwarded.
- Container isolation is defense in depth. Cydetix does not claim resistance to Docker, runc,
  kernel, hypervisor, or trusted-image compromise, or safety for arbitrary hostile native code.
- The writable ephemeral workspace bind mount has no independent byte quota. Rootfs is read-only and
  `/tmp`/`/run` are bounded, but workspace disk exhaustion depends on runtime/host capacity.
- The ephemeral container copy is bounded and text-only; builds requiring ignored dependencies,
  archives, binary assets, files larger than the copy policy, or more than 10,000 files are refused
  or unsupported.
- Atomic replacement and filesystem identity guarantees vary by operating system/filesystem.
  Cross-process privileged TOCTOU elimination is not claimed.

## Validation and release

- The Beta.3 evidence carries forward thirty pinned repositories with two deterministic full-report
  scans each. Implementation-agent review is scoped and lacks independent human adjudication or
  complete ground truth. No corpus-wide recall or generic accuracy is claimed. See
  [current readiness evidence](security/V1_READINESS.md).
- BenchmarkPython reviewed cases are outside current rule applicability and do not become true
  negatives.
- Beta.3 exact-commit hosted gates passed on Linux, Windows, and macOS, including the supported Node
  floor lines, CodeQL, OpenSSF, and the hosted Linux sandbox. That does not establish results for
  every OS, kernel, filesystem, Docker runtime, or later source commit.
- Node.js support is limited to 22.18+ in the 22.x line and 24.11+ in the 24.x line. The Beta.3
  hosted matrix covered the exact floor versions; later patch versions and the current local Node
  runtime provide supplementary evidence, not an all-host guarantee.
- The pinned release workflow requires exact-commit checks, protected environment approval,
  OIDC-only Trusted Publishing and artifact/SBOM attestations. Beta.3 completed that workflow and is
  immutable. A later candidate has no inherited release authority. Bit-for-bit reproducibility is
  not claimed.
- Beta.3 empirically exercised npm Trusted Publishing for the exact repository, workflow, and
  `release` environment. No token fallback is present. External settings remain trusted operational
  state and must be revalidated for a later release.
- Warm-cache local performance measurements are descriptive. The observed FastAPI p95 regression
  remains unresolved; no cross-machine performance or complete large-repository coverage is claimed.
- The public identity is Cydetix. Package registration does not establish brand/legal review,
  exclusivity or trademark clearance.
- Setup adapters and the Codex plugin validate locally and in packed tests. Host-controlled implicit
  tool selection, every live host version, marketplace acceptance, and universal remote plugin
  behavior remain best effort and are not claimed.
- The all-refs privacy audit includes pre-existing remote branches. Known GitHub Dependabot
  identities are allowed only by exact immutable commit/name/email-hash/committer/ref tuples;
  unknown future bot identities continue to fail closed.
- HTML output is not implemented. Terminal, JSON, SARIF, CycloneDX, and remediation JSON are the
  current outputs.
