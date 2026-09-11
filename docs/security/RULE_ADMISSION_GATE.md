# Rule admission gate

Cydetix admits a security rule according to evidence quality, not rule count. A rule that cannot
satisfy this gate must remain `EXPERIMENTAL` or `VALIDATED`, or remain outside the actionable
catalogue. It must not silently behave as a trusted production conclusion.

## Required admission record

Every production-capable rule must declare and substantiate:

1. stable rule ID;
2. rule version;
3. human-readable title;
4. security category;
5. CWE mapping;
6. OWASP Top 10:2025 mapping where applicable;
7. OWASP ASVS 5.0.0 mapping where applicable;
8. explicit security invariant;
9. attack prerequisite;
10. security impact;
11. supported languages;
12. supported frameworks or libraries;
13. detection strategy;
14. required evidence;
15. reachability requirements;
16. confidence model;
17. remediation guidance;
18. maximum permitted remediation class;
19. positive fixtures;
20. negative fixtures;
21. adversarial fixtures;
22. false-positive analysis;
23. false-negative and unsupported-pattern limitations;
24. verification strategy; and
25. user-facing rule documentation.

The executable catalogue schema carries these fields. Tests enforce the complete record for every
Batch 1 rule and keep its fixture paths reviewable.

## Maturity

| Maturity       | Meaning                                                                                                                                                                         | Default authority                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `EXPERIMENTAL` | The model or corpus is incomplete.                                                                                                                                              | Clearly labelled; no fully trusted actionable default.  |
| `VALIDATED`    | Evidence and tests support a bounded use, but one or more production gates remain.                                                                                              | Bounded preview/inspection only.                        |
| `PRODUCTION`   | The invariant, evidence model, controls, limits, false-positive analysis, fixtures, determinism, resource bounds, remediation ceiling, and verification strategy passed review. | Actionable only inside the documented support envelope. |

Production does not mean universal coverage. Unsupported frameworks, unresolved dynamic behavior,
unknown controls, incomplete parsing, unknown reachability, and resource truncation remain visible.

## Batch 1 reviewed mappings

The mappings were checked against OWASP ASVS 5.0.0's authoritative requirement text:

| Rule                 | CWE                    | OWASP Top 10:2025              | ASVS 5.0.0    |
| -------------------- | ---------------------- | ------------------------------ | ------------- |
| SQL injection        | CWE-89                 | A05:2025 Injection             | 1.2.4         |
| OS command injection | CWE-78, CWE-77, CWE-88 | A05:2025 Injection             | 1.2.5         |
| Path traversal       | CWE-22                 | A01:2025 Broken Access Control | 5.3.2         |
| SSRF                 | CWE-918                | A01:2025 Broken Access Control | 1.3.6, 15.3.2 |

Standards are provenance and classification aids. They do not prove that a finding exists.

## Production decision

A Batch 1 rule becomes `PRODUCTION` only after positive, negative, adversarial, incomplete,
determinism, and resource-bound tests pass; its source, sink, control, and reachability models are
reviewed; false-positive risk and unsupported cases are recorded; and its remediation and
verification policies are conservative. Failing any condition lowers maturity; the gate is never
lowered to make the catalogue appear broader.
