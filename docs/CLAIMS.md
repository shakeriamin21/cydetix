# Public claims and evidence

Public documentation must use the narrow claim in this table. Stable `v1.0.1` publication did not
broaden analysis claims. A future release may strengthen a claim only after its evidence changes.

| Claim                                              | Evidence                                                                                          | Maturity / limitation                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Ordinary scans are offline                         | Scan integration tests; OSV requires explicit `online` mode                                       | Validated internal                                                                                                            |
| Ordinary scans do not execute repository code      | Hostile package scripts, formatter/prose, hook, and corpus tests remain inert                     | Validated internal                                                                                                            |
| Repository paths are bounded                       | Canonical path, symlink/junction, traversal, NUL, absolute, and seeded mutation tests             | Validated locally and in the v1.0.1 Windows/Linux/macOS Node 22/24 hosted matrix                                              |
| Secrets are redacted                               | Working-tree/history/report/SARIF/remediation tests                                               | Validated internal; detection coverage is intentionally narrow                                                                |
| Provider failure is not a clean result             | HTTP 500/429, DNS, TLS, malformed, partial, and timeout tests                                     | Validated internal                                                                                                            |
| Current dependency advisory observation is clean   | npm audit: 0; explicit OSV: 214 packages, checked/no findings                                     | Time/provider-bounded; not an exhaustiveness or reachability claim                                                            |
| Cydetix supports Express/Prisma reasoning          | Secure/vulnerable/false-positive cross-file fixtures                                              | Validated internal, narrow relative-ESM scope                                                                                 |
| Cydetix supports authentication protocol proofs    | Session, reset, JWT, OAuth/PKCE, and refresh-token fixtures                                       | Validated internal; unsupported library internals return unknown                                                              |
| Cydetix supports one automatic SAFE remediation    | `AS-SESSION-001` variants, rollback, stale, dirty, path, proof, and idempotency tests             | Validated internal; exactly one SAFE adapter                                                                                  |
| Local verification is explicit                     | Structural argument arrays and CLI tests                                                          | Available degraded; not isolated                                                                                              |
| Container verification fails closed                | Normal container execution followed by simulated daemon loss; unavailable rollback                | Empirically validated on recorded Docker Desktop/WSL2 host                                                                    |
| Authorized container verification applies controls | 13 container adversarial probes plus daemon/image capability probe                                | Network denied; sanitized host env; UID 65534; read-only root; caps dropped; no-new-privileges; seccomp; bounded resources    |
| External validation exists                         | Pinned NodeGoat and BenchmarkPython manifests/results                                             | Initial implementation review, not an independent human study                                                                 |
| Observed NodeGoat finding precision is 100%        | 6 TP / 0 FP across 6 adjudicated emitted findings                                                 | Findings-only sample; recall unavailable; denominator must accompany claim                                                    |
| Package contents are allowlisted                   | `npm pack --json --dry-run` content/path/size gate                                                | Validated on current host                                                                                                     |
| Packed installation works                          | Clean local/global install; npm-exec; version/help/doctor/scan/auth/supply-chain/SBOM/fix dry-run | Exact v1.0.1 package passed Windows/Linux/macOS on Node 22.18 and 24.11; broader host/filesystem combinations are not claimed |
| Release inputs are reproducible                    | Commit/version/tool versions and dependency/schema/catalogue/artifact hashes                      | Reproducible input manifest only; no bit-for-bit claim                                                                        |
| Stable v1.0.1 release provenance exists            | Trusted Release 35085779583; pinned OIDC workflow; npm and GitHub attestations                    | Exact immutable v1.0.1 release evidence; provenance does not establish vulnerability freedom or analysis completeness         |
| Public repository contents and history are audited | HEAD-content audit, deterministic reachable/all-refs metadata policy, independent Gitleaks        | Exact-scope, tool, and reviewed-finding bounds apply; not every possible secret format is detectable                          |
| Hosted CI, CodeQL, and Scorecard passed            | Exact-SHA CI 35084476591, CodeQL 35084476327, OpenSSF 35084476387                                 | Exact v1.0.1 evidence only; future candidates require fresh exact-SHA success                                                 |

Forbidden claims include "zero false positives," "finds every vulnerability," "OWASP compliant,"
"complete website security," "fully isolated," "safe to execute arbitrary untrusted code," "secure
sandbox" without a capability result, and "fixed" when a transaction is anything other than
`APPLIED_VERIFIED` with no unresolved remediation component.

Engine proof labels are `PROVEN_SECURE`, `PROVEN_INSECURE`, and `UNKNOWN` for authentication
invariants, or the corresponding authorization proof states. Agent interpretation and hypothesis
must be labeled separately and cannot upgrade engine uncertainty.
