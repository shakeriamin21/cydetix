# Known limitations

Cydetix is a prerelease static-analysis project, not a guarantee that an application is secure or
compliant.

## Analysis scope

- Cross-file application reasoning is limited to statically named relative ESM imports, literal
  Express routes, direct/namespace calls, narrow supported authentication APIs, and flat Prisma
  selectors.
- CommonJS, path aliases, barrels, dependency injection, decorators, callbacks, computed dispatch,
  raw SQL, nested/compound queries, post-fetch policies, and most Python cross-file semantics are
  unsupported or unknown.
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

- NodeGoat evidence is a findings-only implementation review: six adjudicated positives and one
  needs-domain-context result. Recall and broad precision are unavailable.
- BenchmarkPython reviewed cases are outside current rule applicability and do not become true
  negatives.
- The Phase 6B local run validates packed installation on Windows. A six-case Linux/macOS/Windows
  hosted matrix and a hosted Linux sandbox job are configured for Phase 7, but their state remains
  `NOT_RUN` until the approved public repository executes them.
- Node.js support is limited to 22.18+ in the 22.x line and 24.11+ in the 24.x line; only Node 24.15
  was observed locally, while the six-case Node/OS CI matrix remains unobserved here.
- OpenSSF Scorecard and the hosted matrix are not re-executed by local release preparation. The
  pinned release workflow checks their exact-commit state before publication. Public artifact/SBOM
  attestations and alpha.2 npm OIDC provenance remain unexecuted; bit-for-bit reproducibility is not
  claimed.
- npm Trusted Publishing must be configured from the existing package's settings for the exact
  repository, workflow, and `release` environment. No token fallback is present in the workflow, and
  local preparation does not prove the external setting is configured.
- The public identity is Cydetix and the unscoped npm/CLI name is `cydetix`. A historical exact
  registry lookup returned `cydetix@0.6.0-alpha.1` on 2026-09-06; current registry and dist-tag
  state is not asserted and must be rechecked before release. Registration does not provide
  brand/legal review, exclusivity, or trademark clearance; none is claimed.
- Setup adapters and the Codex plugin validate locally. Host-controlled implicit tool selection,
  remote plugin installation, Copilot CLI MCP consumption, marketplace acceptance, and live npm
  behavior are not claimed until their external tests execute.
- The clean public Git repository has no imported private commits, refs, tags, or remotes. Its first
  commit remains blocked until the user supplies approved public author metadata; inherited global
  Git identity is not used automatically.
- HTML output is not implemented. Terminal, JSON, SARIF, CycloneDX, and remediation JSON are the
  current outputs.
