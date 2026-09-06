# Threat model

## Assets and security objectives

Cydetix protects the operator's workstation/runner, repository confidentiality and integrity,
environment credentials, report confidentiality, and the integrity of security conclusions. The
selected repository is adversarial data even when the operator owns it.

## Trust boundaries

- Trusted: the reviewed cydetix release, its locked dependencies, the explicit CLI arguments, and
  operating-system primitives within their documented guarantees.
- Untrusted: every repository pathname, byte, symlink, config value, Git setting, generated file,
  embedded instruction, dependency manifest, and fixture.
- Separately trusted only after explicit enablement: user-approved execution policy, external
  scanner binaries, network advisory services, container runtime/image, compilers, formatters, and
  target tests. None are used by ordinary scans; repository presence or configuration is never
  consent. GitHub CI, the package registry, release workflow, and signing identity are separate
  release trust boundaries.

## Primary threats and controls

| Threat                             | Current control                                                                                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Path traversal or symlink escape   | Canonical root, component-aware containment, no symlink follow, regular-file check, canonical check before read/write, hostile-path tests           |
| Command or argument injection      | Scan launches no target command; explicit history and tool probes use `spawnSync` without a shell and fixed arguments                               |
| Malicious Git configuration/hooks  | History disables global/system config, hooks and prompts, uses bounded read-only patch inspection, and never checks out commits                     |
| Resource exhaustion                | Iterative traversal; file count, depth, per-file size, SARIF subprocess timeout/buffer; archives and binaries skipped                               |
| Archive/recursive bombs            | Archives are never expanded; symlinked directories are skipped                                                                                      |
| Credential disclosure              | No environment dump; detected values are hashed/redacted; auth evidence never emits JWTs, reset tokens, cookies, OAuth secrets, or private keys     |
| Prompt injection                   | Repository prose is evidence only; CLI correctness does not use an LLM; skills explicitly prohibit repository instructions from changing boundaries |
| Unexpected network access          | Ordinary scan is offline; OSV is explicit and transmits only npm ecosystem/name/version with bounded timeout and structured failure states          |
| Unauthorized mutation              | `scan`/`auth` cannot write; only explicit `fix` intent can enter root-bounded, hash-preconditioned, transactional, verified SAFE remediation        |
| Stale or concurrent patch          | Whole-file and exact-range hashes, affected dirty-file refusal, final identity/hash check, stable finding identity, `STALE_FINDING`                 |
| Partial or interrupted write       | Complete in-memory preparation, exclusive same-directory temporary, file flush, atomic replacement, per-file change journal                         |
| Destructive rollback               | Restore only Cydetix-written paths whose current hash is still the expected patched hash; never repository-wide Git reset/checkout/clean            |
| Malicious verifier/formatter       | No implicit execution; explicit JSON argument arrays, `shell: false`, fixed cwd, stripped environment, no stdin, time/output bounds                 |
| Remediation false-success          | Only `APPLIED_VERIFIED` after parser/authorized checks, deterministic rescan, intended hashes, and invariant transition; rollback remains failure   |
| Secret leakage in patch journal    | Exact secret-range replacements are redacted in unified diffs; portable reports omit source backups, command arguments/output, and absolute root    |
| Encoding or line-ending corruption | Bounded byte-preserving replacement; original line endings, final newline, and mode preserved where supported                                       |
| Misleading assurance               | Coverage and unavailable engines are mandatory; parser failures and unsupported scope are reported                                                  |
| False authorization certainty      | Proofs are tri-state; only supported evidence chains can produce `PROVEN`/`VIOLATED`, and ambiguity returns `UNKNOWN`                               |
| Graph/path resource exhaustion     | Static import/call resolution only; authorization and authentication proof exploration are capped at 10,000 states/items                            |
| False authentication certainty     | Applicability is evaluated first; only supported adapter guarantees can prove a lifecycle, and ambiguity returns `UNKNOWN` without a finding        |
| Supply-chain compromise            | Exact lockfile, no install scripts in CI, pinned Actions, minimal permissions, checksums and attestations in release workflow                       |
| Advisory false-clean result        | Offline, checked-clean, checked-findings, unavailable, and unknown provider states are distinct                                                     |
| Secret leakage through reports     | Raw values never enter normalized exposures; terminal, JSON, SARIF, history, and Agent Skills retain only redaction/fingerprints                    |
| Workflow YAML abuse                | YAML is parsed as bounded untrusted data; workflows and repository scripts are never executed                                                       |
| Container/runtime escape           | Immutable local image; no repository Dockerfile; network none; non-root/read-only; no sockets/devices/privilege; caps dropped; runtime limits       |
| Silent sandbox degradation         | Explicit capability states; unavailable/misconfigured container execution never falls back locally and causes rollback                              |
| Environment or host-file exposure  | Sanitized allowlist and ephemeral repository copy; home, cloud credentials, SSH agent, and Docker socket are not mounted                            |
| Terminal/control injection         | Human-readable untrusted strings are escaped; JSON/SARIF use structural serialization                                                               |
| Benchmark gaming                   | Scanner/evaluator separation; labels load only after scanning and never enter rule execution                                                        |
| External tool/provider failure     | Non-shell bounded probes, sanitized environment, output cap, timeout, validation, and explicit unavailable states                                   |
| Release-package contamination      | npm path/content allowlist, size gate, clean install, developer-path scan, lifecycle ban, SBOM and artifact hashes                                  |

## Residual risks

JavaScript dependencies and the YAML parser are meaningful supply-chain surfaces. Atomic rename
behavior and metadata preservation vary by filesystem. Race resistance is strong but not equivalent
to complete TOCTOU elimination: a privileged local process or filesystem with weak atomicity can
still race path replacement. Local trusted commands remain bounded, non-shell subprocesses, not
isolated sandbox execution; they may use host capabilities. Container isolation depends on Docker,
the host kernel/hypervisor, runtime-default seccomp, and the explicitly trusted image. Phase 6B
observed the configured controls on one Docker Desktop/WSL2 runtime; escape resistance is not
claimed, and the writable ephemeral workspace has no independent disk quota. The secret engine can
fingerprint intentionally fake fixture values. Static analysis can miss dynamic framework behavior,
aliases, policy checks, and ORM query construction. A trusted identity fact means the supported
middleware evidence proves its authenticated origin; it does not prove the application policy is
complete. SARIF upload, if a user configures it, transfers findings to GitHub.

## Fixer-specific transaction boundary

The fixer handles a more dangerous boundary than the scanner. All paths in findings and plans remain
untrusted even when engine-generated. The transaction canonicalizes the selected root and each
affected target, rejects traversal and symlinks, limits input size, requires an existing regular
file, and prepares every transformation before any write. Text edits are exact parsed-range
replacements with non-overlap and idempotency postconditions; repository-controlled regexes or AST
plugins are not loaded.

At apply time the engine refuses affected Git-dirty files and revalidates the scan-time file hash,
exact vulnerable-range hash, canonical target, and file identity. It writes a randomly named,
exclusive temporary sibling and replaces only after transformed bytes exist and are flushed. A
crafted AST, malformed Unicode, large file, changed source, alternate similarly named path, or
symlink cannot relax these checks. The process does not run Git filters or hooks because Git is not
used to write or restore content.

Verification is staged. Parser failure, an explicitly authorized command failure, rescan failure, or
an invariant that remains insecure/unknown triggers rollback. Rollback is conditional on the current
file still being Cydetix's output; concurrent user edits stop restoration and produce
`ROLLBACK_FAILED` rather than overwrite them. This protects user work but can leave a partially
modified repository that requires manual review. Process termination between atomic replacement and
rollback remains a journal/report recovery concern; persistent crash recovery is not implemented.

The engine does not invoke repository formatters. This avoids formatter configuration, plugins,
package scripts, Git hooks, aliases, filters, and embedded "ignore policy" instructions during
normal remediation. If an operator explicitly authorizes local execution, they assume its runtime
trust. Container execution requires a separate explicit provider/image selection and never silently
degrades. Command strings, stdout/stderr, environment credentials, full secrets, original file
backups, and machine-specific root paths are excluded from the remediation report.

## Out of scope for the current release

Scanning a repository does not prove it is secure or compliant. Dynamic execution, active secret
validation, PyPI inventory, SPDX generation, full dependency reachability, Gitleaks result import,
Cosign verification, malicious parser zero-days, encrypted/obfuscated source, full
Unicode-confusable analysis, cross-process filesystem attacks by a privileged local adversary, and
automatic containment of external adapters are not implemented. Persistent crash-recovery journals,
formal or runtime-independent container isolation proof, dependency-aware incremental rescan,
dependency lockfile mutation, credential rotation/revocation, and Git-history rewriting are also not
implemented. Cross-file reasoning is not generic: only the syntax and frameworks named in
[SUPPORT_MATRIX.md](SUPPORT_MATRIX.md) are analyzed, and unsupported patterns do not authorize a
vulnerability conclusion. Authentication analysis does not fetch JWKS documents, contact OAuth/OIDC
providers, decode secrets for display, or trust repository-supplied tokens as safe diagnostic
content.

## Verification-provider requirements

Every executing provider remains separate and opt-in, represents executable/arguments structurally,
shows capability and enabled controls, denies repository-derived authority, strips host credentials,
bounds time/output/resources, and treats results as a distinct verification stage. A container is
not described as hardened unless the daemon reports the required Linux controls, the immutable image
passes a hardened launch probe, and the adversarial properties have actually been tested on the
claimed runtime.
