# Rule coverage

This document describes implemented alpha.8 development coverage. `PRODUCTION` means the bounded
documented patterns passed the admission gate; it does not imply universal vulnerability coverage.

## Maturity summary

- Production: the existing 20 rules plus the four Batch 1 rules below.
- Validated: none.
- Experimental: none enabled by default.
- Unsupported: patterns outside each rule's explicit envelope, including cross-file Batch 1 flows.

## Batch 1 production coverage

| Rule                         | Languages and supported contexts                                                                                                                                                       | Sources                                                                                                 | Sinks                                                                                               | Controls                                                                                                              | Propagation                                                                                 | Known limitations                                                                                                                                                                     | Ceiling           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `AS-INJECTION-SQL-001@1.0.0` | JS/TS: Express, Fastify, Next.js server routes with import-proven pg, mysql/mysql2, sqlite3, Sequelize, Knex, Prisma raw APIs. Python: Flask/FastAPI with DB-API and SQLAlchemy calls. | Recognized request query, body, path/route parameters, headers, cookies, and supported Next URL inputs. | Dynamic SQL structure reaching supported query/execute/raw APIs.                                    | Placeholder SQL with values passed separately; supported ORM parameter binding.                                       | Local aliases, properties, templates, concatenation, same-file JS/TS arguments and returns. | No cross-file flow, dynamic dispatch, arbitrary query builders, stored-procedure analysis, or custom sanitizer proof; Python cross-function flow unsupported.                         | `REVIEW_REQUIRED` |
| `AS-INJECTION-CMD-001@1.0.0` | JS/TS: supported routes plus imported Node `child_process`. Python: Flask/FastAPI plus `os.system` and `subprocess` shell mode.                                                        | Same supported request sources.                                                                         | `exec`, `execSync`, shell-enabled spawn/exec APIs, `os.system`, and `subprocess` with `shell=True`. | Shell-free fixed executable plus argument array/list.                                                                 | Same bounded local propagation.                                                             | Argument injection without a shell is outside this rule; aliases of library objects and cross-file wrappers may be unsupported.                                                       | `REVIEW_REQUIRED` |
| `AS-PATH-001@1.0.0`          | JS/TS: supported routes plus imported Node filesystem and Express response file APIs. Python: Flask/FastAPI plus supported `open`, `os`, and `pathlib` calls.                          | Same supported request sources.                                                                         | Read, write, delete, rename, metadata, download/sendFile, and supported archive/file paths.         | Resolved candidate plus explicit authorized-root containment evidence.                                                | Same bounded local propagation.                                                             | The authorized root is never invented; no symlink/junction race proof, archive-entry normalization proof, or cross-file flow. Platform-specific runtime semantics may remain UNKNOWN. | `REVIEW_REQUIRED` |
| `AS-SSRF-001@1.0.0`          | JS/TS: supported routes plus global/server `fetch`, Axios, Got, node-fetch, and Undici provenance. Python: Flask/FastAPI plus requests, httpx, and urllib calls.                       | Same supported request sources.                                                                         | Untrusted full URL or meaningful destination components reaching supported server HTTP clients.     | Explicit URL parse, HTTPS restriction, and exact hostname membership in a static allowlist for the supported pattern. | Same bounded local propagation.                                                             | No DNS rebinding/resolution, proxy, redirect-chain, IP-range, or organization-policy proof; arbitrary client wrappers and cross-file flows unsupported.                               | `REVIEW_REQUIRED` |

### SQL injection

`AS-INJECTION-SQL-001` proves request input reaches dynamic SQL structure; separate bind parameters
are treated as a contextual control, while dynamic identifiers remain structural.

### OS command injection

`AS-INJECTION-CMD-001` proves request input reaches shell syntax; direct executable/argument-array
execution is excluded from this shell-injection rule.

### Path traversal

`AS-PATH-001` requires a known authorized root, resolution, and explicit containment to establish a
supported control. Cydetix never invents the application's authorized root.

### SSRF

`AS-SSRF-001` distinguishes attacker-controlled destinations from attacker-controlled data sent to a
fixed destination. Cydetix never invents an organization's destination allowlist.

An untrusted value used only as request body or query data for a fixed host is not classified as
SSRF. A database value passed only through a separate bind-parameter channel is not classified as
SQL structure. A shell-free argument array is not classified as shell injection. A mere
`includes("..")` or hostname substring check is not accepted as confinement.

## Carried-forward alpha.7 coverage

The 20 immutable-baseline rule behaviors retain their alpha.7 IDs, versions, detection, confidence,
and remediation behavior. Runtime normalization supplies the new maturity, ceiling, false-positive,
limitations, adversarial-corpus, verification, and documentation fields when reading an older
catalogue record. This is a schema-compatibility admission record, not expanded detection coverage;
each rule remains limited to its declared evidence requirements, negative corpus, languages,
frameworks, and prior deterministic engine.

## Fixture evidence

| Rule                 | Positive | Negative/near-miss | Adversarial | Unknown/incomplete |
| -------------------- | -------: | -----------------: | ----------: | -----------------: |
| SQL injection        |        6 |                  3 |           2 |                  1 |
| OS command injection |        7 |                  3 |           2 |                  1 |
| Path traversal       |        7 |                  3 |           2 |                  1 |
| SSRF                 |        6 |                  3 |           3 |                  1 |

The SSRF adversarial corpus intentionally contains one positive: a hostname substring check that
must not be treated as a strong allowlist. Comments, string literals, dead code, shadowed names,
renamed imports, multiline expressions, wrappers, templates, nested functions, and unknown custom
sanitizers are exercised across the corpus. Dedicated parser-failure and resource-limit cases prove
`PARTIAL` and `TRUNCATED` behavior.

No false positives were observed in the checked negative or non-vulnerable adversarial fixtures.
This statement applies only to this corpus and is not an accuracy percentage.

## Verification strategies

All four rules use invariant reanalysis: a future remediation must change the proof from
`PROVEN_INSECURE` to `PROVEN_SECURE` under complete analysis, not merely remove the original syntax.
No Batch 1 automatic fix is admitted. SQL must prove data/structure separation; commands must prove
shell syntax is not attacker-controlled; paths must prove canonical confinement to a known root;
SSRF must prove an explicit destination policy including the supported scheme/host constraints.
