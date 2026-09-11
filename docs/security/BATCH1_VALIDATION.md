# Batch 1 validation evidence

Development version: `0.6.0-alpha.8`

Runtime catalogue fingerprint at the recorded local gate:
`32ee368c09eac2bcf2b6c1bb14b142b27df67323d607e14044e14197672b2d80`.

Security-control registry fingerprint:
`06f960f8dab8e2a9cc5f963bfc426c8462ef7ce428ccc75f618facd2041593c0`.

## Corpus results

The admission suite produced all 26 expected high-confidence positives. It produced no finding for
any of the 12 negative/near-miss fixtures or six non-vulnerable adversarial fixtures. The SSRF
substring-check adversarial fixture correctly remained one positive because substring matching is
not host confinement. All four custom sanitizer cases produced no insecure proof and surfaced
`SANITIZER_UNKNOWN` with `PARTIAL` analysis. The malformed parser fixture surfaced `PARTIAL`; the
oversized AST fixture surfaced `TRUNCATED` and no Batch 1 proof.

| Rule                 | TP fixtures |  Negative |                                       Adversarial |      Unknown | Observed FP |
| -------------------- | ----------: | --------: | ------------------------------------------------: | -----------: | ----------: |
| SQL injection        |         6/6 | 3/3 clean |                                         2/2 clean | 1/1 explicit |           0 |
| OS command injection |         7/7 | 3/3 clean |                                         2/2 clean | 1/1 explicit |           0 |
| Path traversal       |         7/7 | 3/3 clean |                                         2/2 clean | 1/1 explicit |           0 |
| SSRF                 |         6/6 | 3/3 clean | 2/2 non-vulnerable clean; 1 weak-control positive | 1/1 explicit |           0 |

These are corpus observations, not universal accuracy claims.

## Determinism and remediation

Repeated scans with a fixed analysis time produced identical findings and proof objects plus stable
catalogue, configuration, and suppression fingerprints. Tests separately ignore the explicitly
ephemeral scan ID and timestamps. Remediation monotonicity tests cover every ceiling: incomplete
SAFE evidence downgrades, `REVIEW_REQUIRED` never promotes, and `ARCHITECTURAL` never promotes.

## Local performance sample

On Windows x64, Node `v24.15.0`, ten warm-cache scans per positive corpus produced:

| Corpus  | Files | AST nodes | Facts | Paths | Truncations | Median ms | p95 ms | Max observed positive heap delta |
| ------- | ----: | --------: | ----: | ----: | ----------: | --------: | -----: | -------------------------------: |
| SQL     |     6 |       360 |     7 |    41 |           0 |    29.111 | 34.308 |                  6,254,072 bytes |
| Command |     7 |       332 |     4 |    36 |           0 |    16.705 | 19.491 |                  4,225,240 bytes |
| Path    |     7 |       323 |     5 |    37 |           0 |    19.144 | 23.765 |                  4,159,208 bytes |
| SSRF    |     6 |       279 |     5 |    35 |           0 |    14.612 | 19.501 |                  4,262,000 bytes |

The repeatable gate is 750 ms p95 per corpus. Heap delta is observational, not a process-wide peak
RSS guarantee. Alpha.7 had no Batch 1 engine or corpus, so a direct Batch 1 baseline comparison is
not meaningful; the existing phase benchmarks remain separate regression gates.

## Self-scan

The alpha.8 source self-scan examined 468 files (2,219,217 bytes) statically and returned 0 active
findings and 55 suppressed findings. The suppressions are explicit, owned, expiring, fixture-scoped
records for deliberately vulnerable regression corpora; no new product-source finding was suppressed
to obtain the pass.

## Regression and sandbox

The complete local suite passed 43 test files and 305 tests with no failures or skips while the
pinned Docker image was required. All 13 hardened container tests executed and passed. Formatting,
lint, TypeScript checks, generated-schema freshness, SARIF Multitool validation, CycloneDX SBOM
validation, remediation transactions, skills/plugin checks, the 36-case trigger corpus, exact-root
three-tool MCP validation, version checks, package allowlist, packed installation, workflow
security, public-repository audit, and license audit passed. npm reported zero vulnerabilities at
the high audit threshold. Online OSV checked 214 resolved package identities with no findings and
transmitted no source.
