# Alpha.8 external corpus validation

## Verdict

`ALPHA8_EXTERNAL_CORPUS_VALIDATED`

The originally nominated commit `86ff7f064647334af0f433fad245d99cc29ea2fc` did not pass this gate
unchanged. External repositories exposed generalized Python analysis defects. The minimum
corrections were made in normal commits, the full 19-repository corpus was reacquired/preserved at
pinned SHAs and rescanned twice, and every finding was read against source. The final scanner code
validated by this document is `1d93647ef5e042c3994887a900d8cafa3bef2b27`; the documentation-only
evidence commit is recorded in the final gate section.

## Gate summary

| Measure                                            |           Observation | Gate     |
| -------------------------------------------------- | --------------------: | -------- |
| Pinned external repositories                       |                    19 | PASS     |
| Primary JS/TS repositories                         |                    10 | PASS     |
| Primary Python repositories                        |                     9 | PASS     |
| Ordinary negative repositories                     | 6 (3 JS/TS, 3 Python) | PASS     |
| Actionable Batch 1 findings                        |                    11 | PASS     |
| Manually confirmed true positives                  |                    11 | PASS     |
| Confirmed false positives after correction         |                     0 | PASS     |
| Supported-pattern false negatives after correction |                     0 | PASS     |
| Explicit UNKNOWN observations                      |                     3 | PASS     |
| Outside-supported-scope pattern classes            |                     9 | RECORDED |
| Proofs manually reconstructed                      |                 11/11 | PASS     |
| Deterministic paired scans                         |                 19/19 | PASS     |
| Target repositories modified                       |                  0/19 | PASS     |
| Target code/dependencies/scripts executed          |                     0 | PASS     |

This is a corpus observation, not a global accuracy percentage or a claim of complete coverage.

## Production defects found and corrected

### FastAPI annotated-parameter crash

FastAPI at `50113da16fec53b66b80d75e80a89296de4fa5a5` initially caused a deterministic fail-closed
scan error: a nested `Header()` annotation fragment was treated as a parameter name and inserted
unescaped into a regular expression. Cydetix now admits only valid Python identifiers from the
bounded parameter parser. A regression covers nested FastAPI annotations. Commit:
`f2d584112b593c80dc75c3a4550ade879ec5b355`.

### Python call arguments, controls, and Flask routes

External review then exposed three related generalized defects:

- commas inside multiline SQL strings were mistaken for argument separators, and request parameter
  names appearing as SQL column text could be mistaken for dataflow;
- an unrecognized `_is_safe_url(url)` control was ignored and reported as control absent instead of
  `UNKNOWN`;
- the documented Flask support recognized shortcut decorators but missed canonical `@app.route`;
- treating every preceding function call as a possible control made harmless logging hide a proven
  SSRF flow.

The correction adds bounded quote/bracket-aware Python argument extraction, excludes static string
literals from source matching, makes unknown local controls conservative, treats logging/printing as
non-controls, and recognizes canonical Flask route roots. Regression tests cover multiline
parameterization, nested calls, unknown destination controls, canonical Flask routes, and logging.
Commit: `1d93647ef5e042c3994887a900d8cafa3bef2b27`.

No repository-specific name or path is special-cased. Rule IDs, maturity, remediation ceilings,
security invariants, and production integration behavior were not weakened.

## Per-rule results

| Rule                   | True positives | False positives | Expected UNKNOWN | Outside-scope cases | Supported-pattern false negatives | Proof audit |
| ---------------------- | -------------: | --------------: | ---------------: | ------------------: | --------------------------------: | ----------- |
| `AS-INJECTION-SQL-001` |              4 |               0 |                2 |                   6 |                                 0 | 4/4 PASS    |
| `AS-INJECTION-CMD-001` |              3 |               0 |                0 |                   3 |                                 0 | 3/3 PASS    |
| `AS-PATH-001`          |              1 |               0 |                0 |                   3 |                                 0 | 1/1 PASS    |
| `AS-SSRF-001`          |              3 |               0 |                1 |                   4 |                                 0 | 3/3 PASS    |

Outside-scope columns overlap because one repository/pattern can exercise several rule surfaces; the
deduplicated corpus-level outside-scope count is nine pattern classes.

## Actionable-finding adjudication and proof audit

All 11 findings were audited; no random subsample was necessary. Every row passed source existence,
source trust, propagation, sink semantics/provenance, control evaluation, reachability, invariant,
proof state, and remediation-ceiling checks.

|   # | Repository and location               | Rule | Reconstructed proof                                                                                       | Verdict              |
| --: | ------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------- | -------------------- |
|   1 | AntonyNRM `app.py:37`                 | SQL  | Flask `request.form` -> `username` -> SQL f-string -> imported sqlite execute; no separate parameters     | TRUE_POSITIVE / PASS |
|   2 | AntonyNRM `app.py:57`                 | SQL  | Flask `request.args` -> `username` -> `query` f-string -> imported sqlite execute; no separate parameters | TRUE_POSITIVE / PASS |
|   3 | AntonyNRM `app.py:65`                 | CMD  | Flask `request.args` -> `target` -> shell f-string -> `os.system`                                         | TRUE_POSITIVE / PASS |
|   4 | simple-ssrf `api/app.py:47`           | SSRF | Flask `request.args` -> `url`; logging has no security effect -> `requests.get(url)`                      | TRUE_POSITIVE / PASS |
|   5 | Vikas `server/server.js:120`          | CMD  | Express `req.body.host` -> `userInput` -> command template -> import-proven `child_process.exec`          | TRUE_POSITIVE / PASS |
|   6 | Vikas `server/server.js:267`          | SSRF | Express `req.body.url` -> `url` -> server-side global `fetch(url)`                                        | TRUE_POSITIVE / PASS |
|   7 | Vikas `server/server.js:309`          | SQL  | Express `req.body.username` -> SQL template -> import-proven `mysql2.query` without values array          | TRUE_POSITIVE / PASS |
|   8 | TypeScript lab `src/server.ts:90`     | CMD  | Express `req.query.host` -> template -> import-proven `child_process.exec`                                | TRUE_POSITIVE / PASS |
|   9 | TypeScript lab `src/server.ts:104`    | PATH | Express `req.query.filename` -> `path.join` (no confinement) -> import-proven `fs.readFile`               | TRUE_POSITIVE / PASS |
|  10 | TypeScript lab `src/server.ts:125`    | SSRF | Express `req.query.url` -> `url` -> import-proven `axios.get`                                             | TRUE_POSITIVE / PASS |
|  11 | FastAPI lab `routes_vulnerable.py:39` | SQL  | request-bound `q` -> SQL f-string -> `query` -> imported sqlite execute                                   | TRUE_POSITIVE / PASS |

Each finding remained `PROVEN_INSECURE`, high confidence, likely reachable, control `ABSENT`, and
`REVIEW_REQUIRED`. No rule or runtime assessment promoted remediation to SAFE.

## Parameterization and near-miss review

The FastAPI lab's multiline parameterized sqlite calls were inspected after the correction. User
data is passed in a separate parameter tuple and no SQL finding remains. Fixed-host/client-library
traffic and ordinary process/file APIs in the negative repositories likewise produced no actionable
Batch 1 finding solely from API-name coincidence.

Framework attribution was checked for all findings. JavaScript/TypeScript findings used bound
Express route sources and import-proven `child_process`, `fs`, `mysql2`, or Axios, or server-side
global fetch. Python findings used Flask/FastAPI route sources plus imported sqlite3, `os.system`,
or requests. Local `query`, `fetch`, path-helper, and process-like names in ordinary repositories
did not create findings by name alone.

## UNKNOWN and incomplete analysis

Three external flows remained explicitly unknown:

| Repository and location            | Rule | Reason                                                                                                                                                                         |
| ---------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| breakableflask `main.py:484`       | SQL  | Request data enters custom `query_build(...)`; its SQL control semantics are not proven.                                                                                       |
| FastAPI lab `routes_secure.py:149` | SSRF | `_is_safe_url(url)` is a custom destination policy; alpha.8 does not prove its semantics.                                                                                      |
| FastAPI lab `routes_secure.py:214` | SQL  | Adjacent multiline SQL literals and route-derived identifiers exceed the narrow static-literal proof; parameterization was manually confirmed but Cydetix stayed conservative. |

All carry `SANITIZER_UNKNOWN` and `INSUFFICIENT_DATAFLOW_PROOF`; the containing analysis is
`PARTIAL`. No UNKNOWN, parser failure, or truncation became `PROVEN_SECURE`.

Repository-level completeness observations:

- `TRUNCATED`: fastify/fastify (121 events), fastapi/fastapi (544), django/django (2699), and
  juice-shop/juice-shop (274).
- `PARTIAL`: pallets/flask, breakableflask, and the FastAPI appsec lab.
- `COMPLETE`: the remaining 12 repositories.

## False-negative adjudication

No supported-pattern false negative remains after canonical Flask `app.route` support was corrected.
Nine observed pattern classes were outside the documented proof envelope: MongoDB/NoSQL injection;
Flask-SQLAlchemy wrapper provenance; multiple cross-file Express handler flows; inline CommonJS sink
acquisition; Python cross-file route-to-database flow; simulated SQL without a database sink;
simulated SSRF without an HTTP sink; Django route/source modeling; and truncated large cross-file
graphs. Details and repository examples are in `EXTERNAL_CORPUS_VALIDATION.md`.

Absence in those cases was not reported as security.

## Determinism

All 19 repositories produced identical paired hashes after removing only scan ID, analysis
timestamp, and timing telemetry. The compared payload retained finding IDs, rule IDs, proof,
evidence order, fingerprints, completeness, remediation class/assessment, manifests, coverage,
suppression state, and report summaries.

## Performance and resource bounds

All 38 final scans terminated. No unbounded graph/path growth was observed. The largest path count
was 1984 (Fastify), the maximum iteration count was two, and bounded repositories reported explicit
truncation. Peak sampled working set ranged from 85.4 MiB to 960.3 MiB. Juice Shop was the outlier
at 162.31-165.04 seconds and 879.7-960.3 MiB. This is a documented high-cost limitation, not a claim
of acceptable latency for every repository. The complete table is in
`EXTERNAL_CORPUS_VALIDATION.md`.

## Mutation and hostile-repository safety

The exact local `dist/cli/main.js` runtime performed offline static scans. No package manager,
framework CLI, test, hook, build, migration, Dockerfile, Makefile, target interpreter, or target
scanner was run. No dependency was installed and no `.env` was loaded. All 19 target Git working
trees were clean after the scans. Cydetix reported `mutatedRepository: false`.

## Final gates

The final local regression, sandbox, self-scan, schema/SARIF/SBOM/packaging, advisory, MCP-contract,
and hosted statuses are recorded here after execution:

- Local regression: PASS (`format`, `lint`, `check`, 297 standard tests, complete `verify`)
- Docker sandbox: PASS (13/13 tests with the pinned Node image)
- Self-scan: PASS (472 files, 2,266,655 bytes, 0 active, 55 dated fixture suppressions)
- Trigger corpus: PASS (36/36, 0 missed, 0 unwanted)
- Schemas / SARIF / CycloneDX / packed install: PASS (20 schemas, all six SARIF profiles, CycloneDX
  1.7, 388 package entries, packed install smoke)
- npm audit / online OSV: PASS (0 npm vulnerabilities; 214 OSV identities, no findings, no source
  transmitted)
- MCP exact three-tool contract: PASS
- Hosted CI / CodeQL / OpenSSF Scorecard: required on the evidence commit; exact run IDs are
  recorded in the final operator report after this immutable document is pushed.
- Evidence commit: this document's commit; exact SHA is recorded in the final operator report.
- Working tree: required clean after the evidence commit.

No alpha.8 tag, npm publication, dist-tag change, or release was created by this validation.
