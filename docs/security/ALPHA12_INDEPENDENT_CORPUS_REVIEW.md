# Alpha.12 independent corpus review

This is an independent fresh-context model review of the 30 pinned corpus repositories. The reviewer
did not implement the scanner changes. It is not a human audit or third-party certification. All
work was static: no target code, instructions, lifecycle scripts, tests, scans, benchmarks or
network operations were executed.

The review checks all 134 emitted finding anchors, all 221 engine UNKNOWN anchors and all 13
TRUNCATED repositories. It independently matches the 30 normalized-report digests to their receipts
and the 134 finding source hashes to local files. The machine artifact contains an individual
receipt for every finding and UNKNOWN, exact source ranges, hashes, input digests and the review
limits.

All 81 unique reviewed source files were also compared to pinned Git objects: 72 match exact bytes
and nine differ only by checkout CRLF line endings. No substantive source difference was found. This
check did not audit unreviewed files.

The reviewed primary adjudication SHA-256 is
69a2150ff99d83ccd7b7a73377fb36e6c237ad4637da79541e4583c577e53cca. This pins the pre-reconciliation
claims; later primary-document corrections do not erase the disagreements recorded here.

| Evidence category                  | Count | Independent interpretation                                                                                 |
| ---------------------------------- | ----: | ---------------------------------------------------------------------------------------------------------- |
| Mutable Action references          |    93 | Pinning-policy observations; compromise was not demonstrated.                                              |
| Explicit application configuration |     4 | False cookie flags are present; deployment was not tested.                                                 |
| Explicit test configuration        |     3 | Fixture settings, not deployed application vulnerabilities.                                                |
| Supported local application flows  |    21 | Source/control/sink reviewed statically; runtime exploitability not reproduced.                            |
| Finding-proof UNKNOWN              |    13 | Nine key markers and four password-like observations; one password observation is only a narrative string. |

VULNERABLE and ORDINARY are selection labels, not ground truth. COMPLETE describes the declared
static envelope. Zero findings, UNKNOWN, test fixtures and resource omissions cannot supply
corpus-wide recall, precision or accuracy; none is calculated.

## Disagreements and corrected conclusions

- **IR-CORPUS-001 (payatu-vuln-node)**: Contradicted by normalized report: application metrics have
  76929 AST nodes, 0 truncation events and PARTIAL status. Actual TRUNCATED triggers are security
  identity reaching 8 iterations (390 facts, below 10000) and oversized
  vuln_react_app/package-lock.json. Required reconciliation: Correct primary adjudication cause;
  retain CommonJS/chained-router limitation.
- **IR-CORPUS-002 (sirappsec-vuln-node)**: Contradicted by normalized report: application metrics
  have 10167 AST nodes, 0 truncation events and PARTIAL status. Actual TRUNCATED trigger is
  discovery skipping three oversized vendor assets. Required reconciliation: Correct primary
  adjudication cause; retain CommonJS factory limitation.
- **IR-CORPUS-003 (fastapi-appsec-lab)**: The password-like expression is a quoted element of
  Finding.evidence at 165-189. It does not execute a hash at this location. The engine correctly
  retains UNKNOWN, but its hash-operation message and generic valid-observation label overstate
  semantics. Required reconciliation: Classify this instance as lexical narrative-only noise. Do not
  count it as confirmed executed hashing or an insecure finding.

- **IR-CORPUS-004 (public Flask coverage wording)**: Public XSS sink wording can be read to include
  implicit Flask string/HTML returns. The implementation at
  src/dataflow-analysis/bounded-engine.ts:1908 and 1928-1933 only evaluates explicit call sinks and
  excludes implicit return strings. The corpus omission is outside the implemented envelope, but
  that boundary was not stated precisely in the public table. Required reconciliation: Enumerate
  supported Python HTML call sinks and explicitly exclude implicit Flask string returns. Do not add
  corpus-wide recall or accuracy claims.

The three previously recorded false insecure conclusions are independently confirmed. Flask-Security
utils.py:1439-1468 hashes for a prefix/suffix breach lookup, and the two TypeScript .env:53-54
markers are ellipsis placeholders. Baseline reports contain PROVEN_INSECURE at rule version 1.0.0;
current reports retain the same fingerprints as UNKNOWN at 1.0.1. No key body was disclosed or
actively validated.

The FastAPI lab also stores the MD5 result at routes_vulnerable.py:237-243, whereas
report_service.py:179 only describes that pattern in a string. The we45 source passes a hash into
User/db commit at app/app.py:141-144, but runtime input/type behavior was not tested. Those are
different source situations behind the same engine UNKNOWN category.

## Exact repository identities and review coverage

Every identity below matches manifest, corpus receipt, normalized report and local HEAD/ref.
Per-finding and UNKNOWN source anchors and additional selective ranges are in the machine artifact;
a row with zero findings does not imply a full source audit.

| Repository                                     | Pinned commit                            | Findings | Engine UNKNOWN | Finding UNKNOWN | Completeness |
| ---------------------------------------------- | ---------------------------------------- | -------: | -------------: | --------------: | ------------ |
| OWASP/NodeGoat                                 | c5cb68a7084e4ae7dcc60e6a98768720a81841e8 |        7 |              6 |               1 | TRUNCATED    |
| appsecco/dvna                                  | 9ba473add536f66ac9007966acb2a775dd31277a |        1 |             12 |               0 | TRUNCATED    |
| expressjs/express                              | 53d4a0d606c0388f764f192b306ce0e90200e7e8 |        0 |              1 |               0 | PARTIAL      |
| fastify/fastify                                | d266f833f2bff34c6115c026e461b682e94d0b9c |        0 |              0 |               0 | TRUNCATED    |
| Vikas2171/vulnerable-website                   | 1258fa3efac1547da5bb3c7e6ab8279f00e47206 |       11 |              0 |               0 | COMPLETE     |
| juice-shop/juice-shop                          | 1618a611b173b4bf114028e6e02549950606e29d |       10 |            140 |               3 | TRUNCATED    |
| we45/Vulnerable-Flask-App                      | b6a4f97afd466e83e1f60781494252dec1c37039 |        5 |              3 |               1 | PARTIAL      |
| stephenbradshaw/breakableflask                 | 553e8b2f51c14f259f565d5df478339c366a9172 |        1 |              4 |               0 | PARTIAL      |
| pallets/flask                                  | d73fa1cdcbd8b1465c151db8924ba58b1dd14e35 |        1 |              4 |               0 | PARTIAL      |
| LevaAverGit/appsec-review-lab-v2               | 372ed54ad40059f4228f9e08dc375c51fe60b625 |       10 |              4 |               2 | PARTIAL      |
| vercel/nextjs-postgres-auth-starter            | fde8ecf1da9337223081f70cf88b420060039d6e |        0 |              0 |               0 | COMPLETE     |
| AntonyNRM/vulnerable-flask-app                 | 7a12a015d0fc0d028be5cf492db822bce9af45ba |        3 |              0 |               0 | COMPLETE     |
| axios/axios                                    | 18e7dfedf30c96e58652887f930642ae82e0130c |        1 |              1 |               1 | TRUNCATED    |
| django/django                                  | 2b30f6255b5ef84afbd827993643d52ef2c0963a |       61 |              0 |               0 | TRUNCATED    |
| fastapi/fastapi                                | 50113da16fec53b66b80d75e80a89296de4fa5a5 |        0 |              0 |               0 | TRUNCATED    |
| guilatrova/flask-sqlinjection-vulnerable       | 708246139f2f216c55c683c7aec2297bc91b7346 |        0 |              0 |               0 | COMPLETE     |
| payatu/vuln-nodejs-app                         | bc3c90920ba4e1c668d954e5027d9ca814d2d5c6 |        0 |              4 |               0 | TRUNCATED    |
| vulnerable-apps/simple-ssrf                    | 9fe0f47ca9bc69faf8454e96e0dcdf1400ce8a5a |        1 |              0 |               0 | COMPLETE     |
| SirAppSec/vuln-node.js-express.js-app          | b977c7407f328da929577745ad509639e26c428a |        0 |              1 |               0 | TRUNCATED    |
| ryanmcmorrowsnyk/vulnerable-typescript-app     | 7f8b240a2f02beba099da3632d1ba679ff8bc32f |        9 |              0 |               2 | TRUNCATED    |
| miguelgrinberg/microblog                       | a975ef64864354867c88e0ed3a17ba7d17dca752 |        0 |              0 |               0 | COMPLETE     |
| pallets-eco/flask-security                     | 5d47d697d6f0806d0fe58559fe61cd6fd8ae16ef |        1 |              0 |               1 | TRUNCATED    |
| encode/starlette                               | 03f12b7fcf0a3e21a8da648ca0900c79472e9efe |        0 |              0 |               0 | TRUNCATED    |
| fastapi/full-stack-fastapi-template            | cb740b656d7a0a6c5e12c7bf8e50343ec94ee9c7 |        0 |              1 |               0 | PARTIAL      |
| hagopj13/node-express-boilerplate              | 179ae84efec61b14206d0305d941daed6c6d07f9 |        0 |              8 |               0 | PARTIAL      |
| sahat/hackathon-starter                        | 636440342a5b7b640d127dcde0c405c711c0ddaa |        6 |             31 |               0 | PARTIAL      |
| gothinkster/node-express-realworld-example-app | 30b68e1e881462b2f4164ea09ab4c4f5699c7b0b |        0 |              0 |               0 | COMPLETE     |
| expressjs/session                              | 96ebea4b6cd805584fba04523773b1b918a836d7 |        0 |              0 |               0 | COMPLETE     |
| fastify/fastify-secure-session                 | 06f4afb58d2a91e6350b71a6e491d4604333e6d4 |        0 |              0 |               0 | COMPLETE     |
| strapi/strapi                                  | 34fdea8fb4e11afc475a0ffdc14311cce09ddded |        6 |              1 |               2 | TRUNCATED    |

## Supported flows and selective omission review

All 21 existing local-flow claims survive static review at the following sink/route anchors.
Complete traces and reviewed controls are retained per fingerprint.

| Repository               | File                         | Reviewed emitted anchors                                                                                                                                                                                  |
| ------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| vikas-vulnerable-website | server/server.js             | 117 (AS-CSRF-001), 120 (AS-INJECTION-CMD-001), 170 (AS-XSS-001), 197 (AS-XSS-001), 228 (AS-XSS-001), 231 (AS-CSRF-001), 259 (AS-XSS-001), 267 (AS-SSRF-001), 302 (AS-XSS-001), 309 (AS-INJECTION-SQL-001) |
| breakableflask           | main.py                      | 468 (AS-XSS-001)                                                                                                                                                                                          |
| fastapi-appsec-lab       | app/api/routes_vulnerable.py | 39 (AS-INJECTION-SQL-001)                                                                                                                                                                                 |
| antony-vulnerable-flask  | app.py                       | 37 (AS-INJECTION-SQL-001), 57 (AS-INJECTION-SQL-001), 65 (AS-INJECTION-CMD-001)                                                                                                                           |
| simple-ssrf              | api/app.py                   | 47 (AS-SSRF-001)                                                                                                                                                                                          |
| vulnerable-typescript    | src/server.ts                | 90 (AS-INJECTION-CMD-001), 104 (AS-PATH-001), 117 (AS-XSS-001), 125 (AS-SSRF-001), 239 (AS-REDIRECT-001)                                                                                                  |

Selective negative controls include the parameterized Vikas login query (server/server.js:47-64),
SQL-looking text that TypeScript only logs (src/server.ts:68-84), and the FastAPI lab fetch route
that only returns predefined dictionary responses (routes_vulnerable.py:104-149). Their names and
comments do not create actual SQL/network sinks.

Flask SQL injection crosses an imported Python helper (src/flask_app.py:17-22 to src/db.py:36-48).
Payatu routes use CommonJS controllers and router.route chains; SirAppSec uses a CommonJS app
factory. These are outside the stated composition envelope, with resource limitations recorded
separately. Stored HTML in the FastAPI lab depends on cross-request writer provenance: both escaped
and raw writers exist, so a secure-named route is not itself proof that all stored rows are safe.

Both previously deferred omission candidates are now independently finalized as unsupported patterns
after reviewing the scanner source and public documentation:

- **FN-DEFERRED-01 - finalized: unsupported implicit Flask return sink.** In flask-sqlinjection
  src/flask_app.py:17-30, cpf reaches the disclaimer at 27 and the returned f-string at 30.
  bounded-engine.ts:1908 only enumerates CallExpression ranges; :1928-1933 accepts explicit Markup,
  Response, make_response, render_template_string and HTMLResponse sinks. It does not model implicit
  Flask return strings. This is outside the implemented envelope. RULE_COVERAGE.md:18 is
  under-specified because Flask raw response/Markup does not make that boundary explicit; see
  IR-CORPUS-004.
- **FN-DEFERRED-02 - finalized: unsupported callback/closure propagation.** Vikas
  server/server.js:118-143 reflects host inside an anonymous exec callback.
  bounded-engine.ts:813-820 adds only named direct-call edges; :853-867 derives reachability from
  route roots and those edges; :1250-1253 skips the unreachable callback scope. Facts are keyed by
  function at :874-879/:961, and route response parameters are bound only at :848-850.
  docs/LIMITATIONS.md:11-15 explicitly excludes callbacks. This is outside the implemented
  propagation envelope.

The reviewed engine and RULE_COVERAGE files match the original adjudication source commit
1818a693ef3dd871b01b136af6696a13aa332693. The reviewed LIMITATIONS callback-exclusion lines also
match that commit; unrelated lower sections have changed. Exact source ranges and working/pinned
file hashes are recorded in adapterEnvelopeFollowup in the machine artifact. No engine or public
coverage document was edited by this reviewer.

No additional supported-pattern false negative was conclusively established in this bounded review,
and no omission candidates remain deferred. These exclusions are not claims that the reflected
source is safe. Incomplete source ground truth still prohibits a corpus-wide zero-FN or recall
claim.

## UNKNOWN review

The 220 application-dataflow UNKNOWN records and one authentication UNKNOWN were reviewed. For 202
unresolved Express handlers, review covered the route anchor and composition shape; it did not
validate every handler, credential path and browser lifecycle. Thirteen finding-proof UNKNOWN
records overlap the finding ledger. These totals are not unique vulnerabilities.

- Hackathon Starter app.js:156-165 has global Lusca CSRF protection; multipart routes add it at 313
  and 332. Its unresolved-handler UNKNOWN records do not demonstrate absent CSRF protection.
- Strapi oauth-connect/oauth2.js:115 generates random state; oauth-connect/index.js:118-134
  saves/sends it and :175-179 rejects missing/mismatched state before token exchange. The engine
  retains UNKNOWN for unsupported composition; the source has explicit state controls.
- FastAPI lab routes_secure.py:214-219 uses SQL placeholders and a separate values tuple. Its
  UNKNOWN cannot be described as confirmed SQL injection.
- The we45 Response at app/app.py:185 is followed by application/json mimetype at 189. This is
  counterevidence to treating that UNKNOWN as a confirmed raw-HTML response.
- BreakableFlask main.py:484 wraps SQL with query_build, whose definition at 594 only preserves the
  string or adds a semicolon. The engine does not prove that lambda/cross-function semantic path.
  The :528 HTML branch inserts a constant message and is not independently confirmed XSS.
- The custom FastAPI URL guard checks scheme and address/DNS properties and disables redirects at
  routes_secure.py:109-149. Complete resolver/connect binding was not validated; UNKNOWN remains
  appropriate.
- Full-stack FastAPI CurrentUser depends on bearer/JWT/user checks in backend/app/api/deps.py:16-49.
  Authentication UNKNOWN is not absence of those checks.

## All 13 TRUNCATED repositories

Actual overall TRUNCATED triggers are resource bounds. Parser failures co-occur as PARTIAL syntax
coverage; framework/adapter limitations are separate. No repository is classified as TRUNCATED
solely because its framework is unsupported or its parser failed.

| Repository            | Actual triggers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Co-occurring parser failures |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------: |
| nodegoat              | identity 8/8 iterations, 304 facts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |                            0 |
| dvna                  | file-size skips: docs/resources/appsecco.png                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |                            0 |
| fastify               | identity 8/8 iterations, 558 facts; application 121 bound events; 367893 AST nodes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |                            0 |
| juice-shop            | identity 8/8 iterations, 1193 facts; application 274 bound events; 455124 AST nodes; file-size skips: frontend/src/assets/public/videos/owasp_promo.mp4, screenshots/slideshow.gif                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |                           40 |
| axios                 | identity 8/8 iterations, 413 facts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |                            0 |
| django                | application 2699 bound events; 3485422 AST nodes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |                           64 |
| fastapi               | application 544 bound events; 579574 AST nodes; file-size skips: docs/en/docs/img/deployment/https/https03.drawio.svg                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |                            8 |
| payatu-vuln-node      | identity 8/8 iterations, 390 facts; file-size skips: vuln_react_app/package-lock.json                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |                            0 |
| sirappsec-vuln-node   | file-size skips: src/public/vendor/fonts/boxicons/boxicons.svg, src/public/vendor/libs/apex-charts/apexcharts.js, src/public/vendor/libs/highlight/highlight.js                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                            0 |
| vulnerable-typescript | file-size skips: package-lock.json                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |                            0 |
| flask-security        | application 5 bound events; 251873 AST nodes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |                            0 |
| starlette             | file-size skips: docs/img/gh-actions-fail-test.png                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |                            6 |
| strapi                | identity 8/8 iterations, 9172 facts; application 4553 bound events; 2527328 AST nodes; file-size skips: .yarn/releases/yarn-4.12.0.cjs, docs/static/img/database/reordering-algo-2.png, examples/getstarted/data/uploads/coffee-art.jpg, examples/getstarted/data/uploads/coffee-beans.jpg, examples/getstarted/data/uploads/coffee-shadow.jpg, packages/cli/create-strapi-app/templates/example-js/data/uploads/coffee-art.jpg, packages/cli/create-strapi-app/templates/example-js/data/uploads/coffee-beans.jpg, packages/cli/create-strapi-app/templates/example-js/data/uploads/coffee-shadow.jpg, public/assets/admin-demo.gif, templates/website/data/uploads/user.png, tests/cli/tests/strapi/strapi/**snapshots**/openapi-generate.test.cli.ts.snap, tests/e2e/data/with-admin/assets/uploads/ted_lasso_profile_f4262e821d.jpeg, yarn.lock |                           31 |

For the six application-resource-truncated repositories, normalized aggregate AST counts exceed the
coordinating agent's stated 200000-node repository budget. This supports repository AST exhaustion,
but the immutable reports do not serialize a subtype/location for each truncation event. Counts
cannot distinguish every per-file AST, repository AST, fact or path event. Identity receipts
explicitly reach eight iterations below the 10000-fact cap. File-size skip paths and actual file
sizes are retained in the JSON.

Strapi reports 31 parser/scope failures, including a ResetPassword name collision; source also shows
the CreateLocale imported-contract/component collision at :33/:44. Its bounded summary omits 11
diagnostic paths. Juice Shop, Django, FastAPI and Starlette report 40, 64, 8 and 6 parse failures
respectively. These are coverage limitations; this review did not rerun parsers or invent the
omitted diagnostic details.

## Closure assessment

The requested independent fresh-context model review has been performed for the stated scope,
including final static dispositions for both omission candidates. No further adapter-envelope review
is required for those cases. Primary evidence needs reconciliation for IR-CORPUS-001 through
IR-CORPUS-004, including clearer public Flask sink wording. These are concrete evidence corrections;
broader source or runtime validation remains separate.

This does not close a complete-ground-truth, human-audit, third-party-certification or
corpus-wide-recall requirement. Additional runtime or wider source review would be needed before
making those broader claims.

Machine evidence:
[independent-corpus-review.json](../../validation/alpha12/closure/independent-corpus-review.json).
