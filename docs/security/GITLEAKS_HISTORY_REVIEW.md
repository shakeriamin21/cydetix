# Gitleaks complete-history review

## Scope and outcome

The independent release scan was reproduced against complete fetched Git history with Gitleaks
8.30.1 from the immutable image
`ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f`.
The container retained the release controls: no network, read-only repository and root filesystem,
all capabilities dropped, `no-new-privileges`, resource limits, and a non-root user. On Windows,
Git's `safe.directory=/repo` was supplied in container memory so the bind-mounted repository could
be read without changing it.

Gitleaks inspected 34 commits and emitted 14 redacted findings. Every finding was manually
adjudicated. None is a credential, token, key, or password; none requires revocation, rotation, or
history rewriting. The machine-readable approvals are in
`validation/gitleaks-reviewed-findings.json`. Approval is exact and fail-closed: scope, Gitleaks
version, fingerprint, detector, normalized file, commit, complete location, description, and the
SHA-256 digest of the redacted match must all agree. A path or detector alone never grants approval.

The exact report now validates with 14 reviewed findings and zero unreviewed findings. The raw
report is deliberately not committed because the release workflow regenerates it from immutable
history.

## Finding adjudication

All matched values below are Gitleaks-redacted representations. No underlying value is reproduced.
Every row has rule ID `generic-api-key` and the exact detector description “Detected a Generic API
Key, potentially exposing access to various services and sensitive operations.”

|   # | Rule / description                          | File                                                       | Commit                                     | Range         | Redacted match                                | Current    | Reachable | Classification             | Evidence and detector reason                                                                                                                                                                                                         |
| --: | ------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------ | ------------- | --------------------------------------------- | ---------- | --------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|   1 | `generic-api-key` — generic API-key pattern | `docs/security/ALPHA8_EXTERNAL_CORPUS_VALIDATION.md`       | `c3c9dbbd195cf083ebd1165b35b7762b7bb672c3` | 42:55–43:43   | `FastAPI annotations. Commit:` + `[REDACTED]` | Present    | Yes       | `DOCUMENTATION_EVIDENCE`   | The value is explicitly labelled as a commit, has the 40-lowercase-hex Git object shape, and resolves as the public pinned external-corpus commit. The detector interpreted the high-entropy assignment-like prose as a generic key. |
|   2 | `generic-api-key` — generic API-key pattern | `fixtures/phase4/secret-exposed/config.ts`                 | `a73cb30e9e45e0a05c2596680fc9c523bda50228` | 2:15–2:79     | `credential = "[REDACTED]"`                   | Present    | Yes       | `INTENTIONAL_TEST_FIXTURE` | The file declares a deliberately nonfunctional, fixture-only namespace used to exercise secret detection. The credential assignment and token-like length intentionally satisfy the generic detector.                                |
|   3 | `generic-api-key` — generic API-key pattern | `tests/remediation/safe-fix.test.ts`                       | `a73cb30e9e45e0a05c2596680fc9c523bda50228` | 68:46–68:80   | `SECRET", "[REDACTED]"`                       | Present    | Yes       | `INTENTIONAL_TEST_FIXTURE` | The test constructs synthetic material in a temporary repository and asserts remediation output does not disclose it. The secret-labelled argument intentionally resembles a credential.                                             |
|   4 | `generic-api-key` — generic API-key pattern | `tests/verification/container-sandbox.integration.test.ts` | `a73cb30e9e45e0a05c2596680fc9c523bda50228` | 58:7–58:61    | `CYDETIX_TEST_AWS_SECRET: "[REDACTED]"`       | Present    | Yes       | `INTENTIONAL_TEST_FIXTURE` | This synthetic environment canary is test-scoped, cleaned up, and asserted not to enter the container. The provider-style variable name and value shape intentionally trigger generic detection.                                     |
|   5 | `generic-api-key` — generic API-key pattern | `tests/verification/container-sandbox.integration.test.ts` | `a73cb30e9e45e0a05c2596680fc9c523bda50228` | 428:11–428:61 | `secret = "[REDACTED]"`                       | Present    | Yes       | `INTENTIONAL_TEST_FIXTURE` | This nonfunctional token-shaped canary verifies sandbox output redaction and is never used for authentication. Its assignment form and entropy intentionally trigger the detector.                                                   |
|   6 | `generic-api-key` — generic API-key pattern | `dist/remediation/model.d.ts`                              | `068f87c71a033f18dc69862261ec4f8478909f48` | 62:11–62:61   | `[REDACTED]": "[REDACTED]"`                   | Present    | Yes       | `FALSE_POSITIVE_PATTERN`   | Generated declaration of the non-secret remediation-plan enum label `secret-incident-plan-v1`; repeated secret-related words and assignment syntax match the generic detector.                                                       |
|   7 | `generic-api-key` — generic API-key pattern | `dist/remediation/model.d.ts`                              | `068f87c71a033f18dc69862261ec4f8478909f48` | 122:15–122:65 | `[REDACTED]": "[REDACTED]"`                   | Present    | Yes       | `FALSE_POSITIVE_PATTERN`   | Generated repetition of the same non-secret enum label; the declaration shape matches the generic detector.                                                                                                                          |
|   8 | `generic-api-key` — generic API-key pattern | `dist/remediation/model.d.ts`                              | `068f87c71a033f18dc69862261ec4f8478909f48` | 331:15–331:65 | `[REDACTED]": "[REDACTED]"`                   | Present    | Yes       | `FALSE_POSITIVE_PATTERN`   | Generated repetition of the same non-secret enum label; the declaration shape matches the generic detector.                                                                                                                          |
|   9 | `generic-api-key` — generic API-key pattern | `dist/remediation/model.d.ts`                              | `068f87c71a033f18dc69862261ec4f8478909f48` | 560:19–560:69 | `[REDACTED]": "[REDACTED]"`                   | Present    | Yes       | `FALSE_POSITIVE_PATTERN`   | Generated repetition of the same non-secret enum label; the declaration shape matches the generic detector.                                                                                                                          |
|  10 | `generic-api-key` — generic API-key pattern | `dist/remediation/model.d.ts`                              | `068f87c71a033f18dc69862261ec4f8478909f48` | 638:19–638:69 | `[REDACTED]": "[REDACTED]"`                   | Present    | Yes       | `FALSE_POSITIVE_PATTERN`   | Generated repetition of the same non-secret enum label; the declaration shape matches the generic detector.                                                                                                                          |
|  11 | `generic-api-key` — generic API-key pattern | `fixtures/phase4/secret-exposed/config.ts`                 | `068f87c71a033f18dc69862261ec4f8478909f48` | 2:15–2:84     | `credential = "[REDACTED]"`                   | Superseded | Yes       | `INTENTIONAL_TEST_FIXTURE` | Reachable predecessor of finding 2 under the former product namespace. It was the same deliberately nonfunctional fixture, and the credential assignment intentionally matched.                                                      |
|  12 | `generic-api-key` — generic API-key pattern | `tests/remediation/safe-fix.test.ts`                       | `068f87c71a033f18dc69862261ec4f8478909f48` | 68:51–68:85   | `SECRET", "[REDACTED]"`                       | Superseded | Yes       | `INTENTIONAL_TEST_FIXTURE` | Reachable predecessor of finding 3 under the former product namespace. It contained the same synthetic redaction-test material.                                                                                                      |
|  13 | `generic-api-key` — generic API-key pattern | `tests/verification/container-sandbox.integration.test.ts` | `068f87c71a033f18dc69862261ec4f8478909f48` | 58:8–58:67    | `[legacy test variable]: "[REDACTED]"`        | Superseded | Yes       | `INTENTIONAL_TEST_FIXTURE` | Reachable predecessor of finding 4 under the former product namespace. It was the same synthetic environment-isolation canary.                                                                                                       |
|  14 | `generic-api-key` — generic API-key pattern | `tests/verification/container-sandbox.integration.test.ts` | `068f87c71a033f18dc69862261ec4f8478909f48` | 428:12–428:67 | `secret = "[REDACTED]"`                       | Superseded | Yes       | `INTENTIONAL_TEST_FIXTURE` | Reachable predecessor of finding 5 under the former product namespace. It was the same synthetic output-redaction canary.                                                                                                            |

Classification totals: one `DOCUMENTATION_EVIDENCE`, eight `INTENTIONAL_TEST_FIXTURE`, and five
`FALSE_POSITIVE_PATTERN`. There are zero `REAL_SECRET`, zero `PUBLIC_NON_SECRET_IDENTIFIER`, and
zero `UNKNOWN_REQUIRES_REVIEW` findings.

## Alpha.9 release history

`v0.6.0-alpha.9` is an immutable failed release attempt. Its release-context validation, exact
hosted CI, OpenSSF verification, and deterministic history audit passed. The independent Gitleaks
complete-history scan then found the 14 findings above; the first unreviewed record was in
`docs/security/ALPHA8_EXTERNAL_CORPUS_VALIDATION.md`. The publication job was skipped. No npm
package, public GitHub prerelease, release asset, provenance attestation, or CycloneDX SBOM
attestation was created for alpha.9.

The tag object remains `6fc76ad5ec27fdc921bdb439a30ce3f6b5996e57`, targeting commit
`fa048d2f66d337198df9085bfcf1f491eda9dcfd`. Neither object may be moved or recreated.
