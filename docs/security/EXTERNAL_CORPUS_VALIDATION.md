# Alpha.8 external corpus validation method

## Scope

This corpus validates the production behavior of `AS-INJECTION-SQL-001`, `AS-INJECTION-CMD-001`,
`AS-PATH-001`, and `AS-SSRF-001` against source repositories that were not written as Cydetix
fixtures. The corpus contains 19 pinned repositories: 13 deliberately vulnerable applications and
six ordinary repositories. Ten have JavaScript or TypeScript as their primary application language
and nine have Python as their primary application language.

The immutable repository identities and selection rationale are in `EXTERNAL_CORPUS_MANIFEST.json`.
Raw JSON reports and stderr captures were retained outside this repository under
`<system-temp>\cydetix-alpha8-external-corpus-20260911` for the duration of this validation.
External source trees and raw reports are not release artifacts and are not committed.

## Acquisition and hostile-target policy

Each repository was cloned from its public Git remote on 2026-09-11 and checked out detached at the
SHA in the manifest. Git system/global configuration and checkout hooks were disabled for corpus
acquisition. No moving branch name is used as evidence.

No target package, application, interpreter, test, hook, framework command, build, migration,
Makefile, Dockerfile, or scanner supplied by a target was executed. No dependency was installed and
no target `.env` file was loaded. Network access was used only for Git acquisition. Cydetix scans
were offline static scans.

The exact invocation was equivalent to:

```text
<absolute local Node> <repository-root>\dist\cli\main.js scan <pinned-corpus-path> --offline --format json --non-interactive
```

The report itself was required to identify Cydetix `0.6.0-alpha.8`, the target's canonical root, and
the target Git SHA. `npx`, npm dist-tags, global Cydetix installations, and target-local launchers
were not used.

## Procedure

Every repository was scanned twice after the final generalized corrections. The determinism
comparison removed only scan ID, analysis timestamp, and timing telemetry. It then compared the
complete manifest, security analysis, findings, proof objects, evidence ordering, fingerprints,
completeness, remediation assessments, suppressions, and summary. All 19 pairs matched.

Every actionable Batch 1 finding was manually reviewed in source. A label or README assertion was
not accepted as ground truth. Review required a real request source, real propagation, correct sink
semantics and provenance, control evaluation, reachable route, and a conclusion that followed from
the rule invariant. All 11 findings were audited, exceeding the requested ten-finding sample.

All target repositories were clean under `git status --porcelain=v1 --untracked-files=all` after the
scans.

## Performance corpus

Times are wall-clock seconds for run 1 / run 2. Peak is sampled process peak working set in MiB for
run 1 / run 2. AST, facts, paths, iterations, truncations, and completeness were identical between
paired runs.

| Repository                                 | Files |         Seconds |      Peak MiB | Dataflow files | AST nodes | Facts | Paths | Iterations | Truncations | Completeness |
| ------------------------------------------ | ----: | --------------: | ------------: | -------------: | --------: | ----: | ----: | ---------: | ----------: | ------------ |
| OWASP/NodeGoat                             |   104 |    7.52 / 10.68 | 363.5 / 366.4 |             50 |    102969 |     0 |   121 |          1 |           0 | COMPLETE     |
| we45/Vulnerable-Flask-App                  |    18 |     3.36 / 2.64 | 235.7 / 234.7 |              4 |     49304 |    34 |    84 |          2 |           0 | COMPLETE     |
| appsecco/dvna                              |   128 |     2.67 / 2.19 | 238.7 / 240.5 |             14 |     43710 |     0 |    72 |          1 |           0 | COMPLETE     |
| fastify/fastify                            |   390 |   32.88 / 33.71 | 684.8 / 685.4 |            176 |    367893 |     0 |  1984 |          1 |         121 | TRUNCATED    |
| expressjs/express                          |   213 |     4.40 / 3.97 | 294.6 / 293.9 |            141 |     80490 |     0 |   829 |          1 |           0 | COMPLETE     |
| axios/axios                                |   459 |   28.84 / 28.74 | 483.8 / 483.7 |            242 |    166786 |     1 |   962 |          2 |           0 | COMPLETE     |
| pallets/flask                              |   231 |     1.32 / 1.25 | 102.7 / 103.3 |             81 |    103421 |     2 |   174 |          2 |           0 | PARTIAL      |
| fastapi/fastapi                            |  2951 |     6.97 / 5.99 | 262.5 / 263.1 |            590 |    579574 |    68 |   673 |          2 |         544 | TRUNCATED    |
| django/django                              |  5709 |   39.68 / 36.94 | 590.1 / 591.0 |            280 |   3485422 |     0 |   179 |          1 |        2699 | TRUNCATED    |
| AntonyNRM/vulnerable-flask-app             |     4 |     0.70 / 0.86 |   87.2 / 86.2 |              2 |      2094 |    22 |    74 |          2 |           0 | COMPLETE     |
| vulnerable-apps/simple-ssrf                |     8 |     0.69 / 0.62 |   85.4 / 85.5 |              1 |       324 |     2 |     5 |          2 |           0 | COMPLETE     |
| SirAppSec/vuln-node.js-express.js-app      |    59 |     1.59 / 1.58 | 158.9 / 158.8 |             30 |     10167 |     0 |    86 |          1 |           0 | COMPLETE     |
| Vikas2171/vulnerable-website               |    15 |     0.92 / 0.94 |   95.0 / 95.8 |              1 |       959 |    22 |    90 |          2 |           0 | COMPLETE     |
| ryanmcmorrowsnyk/vulnerable-typescript-app |     7 |     0.87 / 0.75 |   96.9 / 96.1 |              1 |      1462 |    22 |   160 |          2 |           0 | COMPLETE     |
| stephenbradshaw/breakableflask             |     8 |     0.70 / 0.70 |   88.4 / 88.3 |              1 |      6005 |    22 |    84 |          2 |           0 | PARTIAL      |
| guilatrova/flask-sqlinjection-vulnerable   |    17 |     0.68 / 0.64 |   87.8 / 88.3 |              6 |       868 |     3 |     4 |          2 |           0 | COMPLETE     |
| LevaAverGit/appsec-review-lab-v2           |    64 |     0.99 / 0.82 |   96.5 / 96.1 |             31 |     20832 |    63 |   153 |          2 |           0 | PARTIAL      |
| payatu/vuln-nodejs-app                     |    75 |     7.86 / 6.77 | 305.6 / 304.7 |             19 |     76929 |     0 |   172 |          1 |           0 | COMPLETE     |
| juice-shop/juice-shop                      |  1168 | 165.04 / 162.31 | 960.3 / 879.7 |            340 |    455124 |     0 |  1708 |          1 |         274 | TRUNCATED    |

Fastify, FastAPI, Django, and Juice Shop demonstrate the repository AST bound. Flask's own
repository contains parser-incomplete files. In each case incomplete analysis was visible and did
not become `PROVEN_SECURE`. Juice Shop is the high-cost outlier: it terminates deterministically,
but approximately 2.7 minutes and up to 960.3 MiB working set is a documented performance limitation
for this corpus.

## Scope adjudication rules

An absent finding was counted as a supported-pattern false negative only if the framework, source,
propagation, sink, and static evidence were all within documented support and no completeness or
resource limitation applied. The following representative cases were not counted as false negatives:

- NodeGoat uses MongoDB/NoSQL data access, which is not `AS-INJECTION-SQL-001`.
- we45/Vulnerable-Flask-App reaches raw SQL through the Flask-SQLAlchemy wrapper pattern, which is
  not in the exact imported Python sink model.
- DVNA, SirAppSec, and payatu register handlers across modules; alpha.8 does not claim cross-file
  JavaScript/TypeScript Batch 1 propagation. SirAppSec also uses inline CommonJS requires.
- guilatrova/flask-sqlinjection-vulnerable moves route-to-sink propagation through a Python helper
  module; Python cross-file propagation is unsupported.
- the TypeScript lab's SQL text is a simulation with no database sink.
- the FastAPI lab's vulnerable SSRF demonstration deliberately has no HTTP request sink.
- Juice Shop was truncated and has a large cross-file graph; no absence claim was made.
- Django route/source behavior is not a documented Batch 1 Python route model.

These are nine observed outside-scope pattern classes, not nine claims that the repositories are
secure.

## Secondary scanners

No third-party scanner was installed or executed. Repository-provided scanner scripts and results
were not treated as ground truth.
