# Standards traceability

Cydetix rule mappings are traceability aids, not compliance certificates. A rule maps only the
invariant it directly checks, and the coverage report records everything the scan did not establish.

## Normative/current baselines used for implemented rules

- [OWASP ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Top 10:2025](https://owasp.org/Top10/)
- [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [IETF RFC 9700 / BCP 240](https://www.rfc-editor.org/rfc/rfc9700.html)
- [IETF RFC 7636 PKCE](https://www.rfc-editor.org/rfc/rfc7636.html)
- [IETF RFC 8725 / BCP 225 JWT Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725.html)
- [OpenID Connect Core 1.0 incorporating Errata Set 2](https://openid.net/specs/openid-connect-core-1_0-errata2.html)
- [MITRE CWE](https://cwe.mitre.org/)
- [OSV API and schema](https://google.github.io/osv.dev/api/)
- [Package URL specification](https://www.packageurl.org/docs/purl/introduction)
- [CycloneDX 1.7](https://cyclonedx.org/specification/overview/)
- [SPDX 3.0](https://spdx.dev/use/specifications/) (current, output not implemented)
- [SLSA 1.2](https://slsa.dev/spec/v1.2/) (approved; evidence model only)
- [in-toto Attestation v1.2](https://github.com/in-toto/attestation/tree/main/spec/v1)
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [Sigstore/Cosign](https://docs.sigstore.dev/cosign/signing/signing_with_blobs/) (architecture
  only)
- [SARIF 2.1.0 OASIS Standard with Errata 01 schema](https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/)

Supporting implementation guidance is taken from current OWASP Cheat Sheet Series material for
authentication, session management, password storage, OAuth 2.0, JWT, REST security, CSRF, CORS,
authorization, IDOR prevention, and secrets management.

OAuth 2.1 remains an active Internet-Draft at the Phase 3 review date and is not normative detector
guidance. OAuth security rules use RFC 9700 / BCP 240 and RFC 7636. Each Phase 3 mapping separately
records `REQUIRED`, `RECOMMENDED`, or `CONTEXT_DEPENDENT` so contextual guidance does not silently
become an unconditional vulnerability.

## Implemented mapping matrix

| Rule                 | ASVS 5.0.0    | OWASP Top 10:2025 | CWE        | NIST                 |
| -------------------- | ------------- | ----------------- | ---------- | -------------------- |
| AS-SESSION-001       | 3.3.1, 3.3.4  | A07               | 614, 1004  | SP 800-63B-4 5.1.1   |
| AS-PASSWORD-001      | 11.4.2        | A04, A07          | 916        | SP 800-63B-4 3.1.1.2 |
| AS-TOKEN-001         | 7.2.1         | A07               | 347        | -                    |
| AS-SECRET-001        | 13.3.1        | A02               | 798        | -                    |
| AS-CORS-001          | 3.4.2         | A02               | 942        | -                    |
| AS-AUTHZ-001         | 8.2.2, 8.3.1  | A01               | 639        | -                    |
| AS-TENANT-001        | 8.3.1, 8.4.1  | A01               | 862        | -                    |
| AS-AUTH-SESSION-001  | 7.2.4         | A07               | 384        | -                    |
| AS-AUTH-SESSION-002  | 7.4.1         | A07               | 613        | SP 800-63B-4 5       |
| AS-AUTH-RESET-001    | 7.4.3         | A07               | 613        | -                    |
| AS-AUTH-RESET-002    | 6.4.3         | A07               | 640        | -                    |
| AS-AUTH-RESET-003    | 6.4.3         | A07               | 640, 330   | -                    |
| AS-AUTH-JWT-001      | 9.1.1         | A07               | 347        | -                    |
| AS-AUTH-OAUTH-001    | 10.2.1        | A07               | 352        | -                    |
| AS-AUTH-OAUTH-002    | 10.4.6        | A07               | 345        | -                    |
| AS-SCA-001           | -             | A03               | 1395       | -                    |
| AS-CI-001            | -             | A03               | 829        | -                    |
| AS-CI-002            | -             | A03               | 250        | -                    |
| AS-CI-003            | -             | A03               | 829, 250   | -                    |
| AS-CI-004            | -             | A05               | 78         | -                    |
| AS-INJECTION-SQL-001 | 1.2.4         | A05               | 89         | -                    |
| AS-INJECTION-CMD-001 | 1.2.5         | A05               | 78, 77, 88 | -                    |
| AS-PATH-001          | 5.3.2         | A01               | 22         | -                    |
| AS-SSRF-001          | 1.3.6, 15.3.2 | A01               | 918        | -                    |
| AS-XSS-001           | 1.2.1, 1.2.3  | A05               | 79         | -                    |
| AS-REDIRECT-001      | 3.7.2         | A01               | 601        | -                    |
| AS-CSRF-001          | 3.5.1         | A01               | 352        | -                    |

The complete machine-readable metadata is in `rules/catalogue.json`. This matrix means twenty-seven
narrowly defined checks exist; it does not mean all related ASVS, Top 10, CWE, or NIST requirements
were evaluated. Phase 2 authorization mappings follow ASVS V8. Phase 3 authentication mappings use
version-pinned ASVS V6, V7, V9, and V10 plus protocol standards where applicable. Neither layer is a
broader compliance certification.

Phase 4 supply-chain mappings use a separate machine-readable relationship field with `REQUIRED`,
`RECOMMENDED`, or `CONTEXT_DEPENDENT`. No ASVS mapping is manufactured where ASVS is not the useful
authority. SLSA evidence does not imply a level; SPDX 3.0 is tracked without claiming output; and
the approved SLSA 1.2 and current CycloneDX 1.7 specifications are kept distinct from drafts.

## Update policy

Standards identifiers are version-pinned. A standards release does not silently change historical
rule semantics. Updating a mapping requires source review, fixture review, rule version evaluation,
and regenerated catalogue output.
