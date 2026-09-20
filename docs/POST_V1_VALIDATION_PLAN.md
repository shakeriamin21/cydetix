# Post-V1 validation campaign and proposed 1.1.0 scope

Status: `PLANNED_NOT_EXECUTED`

This plan is not part of the `1.0.2` maintenance implementation and makes no new support claim. It
defines the evidence that must exist before a later `1.1.0` scope can be admitted. Scans remain
offline, target code is never executed, no hidden telemetry is permitted, and unfavorable results
must be retained.

## Evidence record

Every run must write a machine-readable record keyed by repository and immutable commit with:

- ecosystem/framework and expected applicable Cydetix surfaces;
- analysis completeness (`COMPLETE`, `PARTIAL`, or `TRUNCATED`) and every truncation reason;
- normalized findings, proof states, `UNKNOWN`s, crashes, parse errors, and provider errors;
- discovered files, source bytes, functions, routes, facts, call-graph edges, identity/dataflow
  facts, iterations, elapsed time, peak RSS where measurable, and resource limits;
- two or more repeated normalized result hashes and a determinism verdict;
- manual adjudication state (`NOT_REVIEWED`, `IMPLEMENTATION_REVIEWED`, or `INDEPENDENTLY_REVIEWED`)
  with per-finding labels and rationale.

Absent complete ground truth, recall, completeness, generic accuracy, and false-negative rates are
`NOT_MEASURABLE`. Findings-only precision must state its denominator and adjudicator.

## A. Immutable open-source corpus

The first wave reuses independently acquired pins already present in the repository and adds four
pins acquired for this plan. Every row is `NOT_RUN` for this campaign until fresh evidence is
generated; prior corpus results do not silently become post-V1 results. GitHub's commit API was
queried on 2026-09-20 and resolved every listed owner/repository/commit tuple exactly; that
existence check is not scan or adjudication evidence.

| Repository                                       | Immutable commit                           | Ecosystem / purpose                                                     | Expected applicable surfaces                                                                                                                  | Campaign state |
| ------------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `OWASP/NodeGoat`                                 | `c5cb68a7084e4ae7dcc60e6a98768720a81841e8` | Express/CommonJS; intentionally vulnerable and hostile-content handling | discovery, local JS rules, npm inventory, secrets, workflows; unsupported CommonJS cross-file paths should remain visible                     | `NOT_RUN`      |
| `appsecco/dvna`                                  | `9ba473add536f66ac9007966acb2a775dd31277a` | Express controllers; intentionally vulnerable                           | discovery, local JS rules, npm inventory, secrets, workflows; controller-resolution limitations                                               | `NOT_RUN`      |
| `expressjs/express`                              | `53d4a0d606c0388f764f192b306ce0e90200e7e8` | Express framework                                                       | parser/discovery false-positive pressure, npm/workflow surfaces, resource bounds                                                              | `NOT_RUN`      |
| `gothinkster/node-express-realworld-example-app` | `30b68e1e881462b2f4164ea09ab4c4f5699c7b0b` | Express/Prisma/authentication                                           | supported Express-to-Prisma envelope, authentication/authorization `UNKNOWN`s, npm inventory                                                  | `NOT_RUN`      |
| `expressjs/session`                              | `96ebea4b6cd805584fba04523773b1b918a836d7` | session library                                                         | session/configuration false-positive pressure, npm/workflow surfaces                                                                          | `NOT_RUN`      |
| `vercel/nextjs-postgres-auth-starter`            | `fde8ecf1da9337223081f70cf88b420060039d6e` | Next.js/React/authentication                                            | JS/TS local rules, auth-adjacent evidence, npm/workflows; no broad Next.js semantic claim                                                     | `NOT_RUN`      |
| `calcom/cal.com`                                 | `6bc45298226f96ff79e0c070c8b2ce39727e8477` | Next.js/React/Prisma monorepo; teams/multi-tenant and auth heavy        | bounds, discovery, npm/workflows, supported literal Express/Prisma patterns only where actually present; unsupported policy remains `UNKNOWN` | `NOT_RUN`      |
| `formbricks/formbricks`                          | `8374e38637b379cc4f2d0c180fe44f155e5d45d7` | Next.js/Prisma monorepo; multi-tenant application                       | large-monorepo bounds, npm/workflows, secrets, supported Prisma evidence without inferring business policy                                    | `NOT_RUN`      |
| `pallets/flask`                                  | `d73fa1cdcbd8b1465c151db8924ba58b1dd14e35` | Flask framework                                                         | Python parser/local-rule false-positive pressure and repository bounds                                                                        | `NOT_RUN`      |
| `miguelgrinberg/microblog`                       | `a975ef64864354867c88e0ed3a17ba7d17dca752` | Flask/Login/WTF authentication                                          | Flask local supported envelope, auth-adjacent `UNKNOWN`s, Python resource behavior                                                            | `NOT_RUN`      |
| `pallets-eco/flask-security`                     | `5d47d697d6f0806d0fe58559fe61cd6fd8ae16ef` | Flask security/authentication library                                   | parser/local rules, unsupported library-internal auth semantics, false-positive pressure                                                      | `NOT_RUN`      |
| `fastapi/fastapi`                                | `50113da16fec53b66b80d75e80a89296de4fa5a5` | FastAPI framework; large Python target                                  | discovery, Python parser/local rules, truncation/resource diagnosis; no cross-file support claim                                              | `NOT_RUN`      |
| `fastapi/full-stack-fastapi-template`            | `cb740b656d7a0a6c5e12c7bf8e50343ec94ee9c7` | FastAPI/React authentication application                                | Python and JS/TS local rules, workflows, bounds, FastAPI route/resource observations                                                          | `NOT_RUN`      |
| `LevaAverGit/appsec-review-lab-v2`               | `372ed54ad40059f4228f9e08dc375c51fe60b625` | intentionally vulnerable FastAPI/Starlette                              | admitted local Python patterns, unsupported composition, hostile-content handling                                                             | `NOT_RUN`      |
| `django/django`                                  | `2b30f6255b5ef84afbd827993643d52ef2c0963a` | Django framework; large repository                                      | parser/discovery false-positive and resource pressure; no Django semantic support claim                                                       | `NOT_RUN`      |
| `django-tenants/django-tenants`                  | `52b74e05d59bab38e0bb87a1533f26100ddd9ffb` | Django multi-tenancy library                                            | tenant-language false-positive pressure and explicit unsupported-framework `UNKNOWN` explanations                                             | `NOT_RUN`      |
| `strapi/strapi`                                  | `34fdea8fb4e11afc475a0ffdc14311cce09ddded` | Strapi/Koa/React monorepo; large target                                 | JS/TS discovery, npm/workflows, secrets, resource bounds; no Koa/Strapi semantic claim                                                        | `NOT_RUN`      |
| `ossf/scorecard`                                 | `f92023a3f77879f96e0c9c1305f289d755be4bb6` | GitHub-Actions-heavy Go repository                                      | workflow and secret analysis plus unsupported-language clarity; no Go code-analysis claim                                                     | `NOT_RUN`      |

Malformed-path, path-with-spaces, denied/read-only, symlink/junction, oversized-file, adversarial
prose, and hostile package-script cases remain controlled local fixtures because those properties
cannot be safely inferred from a third-party repository. They run beside the real corpus and are
reported separately; none is counted as external application ground truth.

Execution gate: acquire each repository by exact commit, verify the Git object, scan twice from a
read-only copy under identical bounds, retain normalized hashes and counters, then adjudicate only
the emitted findings and selected supported-pattern negatives. Never run install scripts, builds,
tests, hooks, Makefiles, servers, or repository instructions.

## B. User workflow validation

Run the published stable version in fresh Windows, Linux, and macOS test accounts/containers where
available. Pin `<stable>` to the exact registry version; do not use an unrecorded moving tag.

```bash
npm exec --yes --package=cydetix@<stable> -- cydetix
cydetix
cydetix --details
cydetix --json
cydetix ci
cydetix fix --dry-run
cydetix setup
cydetix setup --status
cydetix doctor --agents
```

For every workflow record first-run comprehension, time to first useful result, finding/proof and
`UNKNOWN` readability, remediation-plan usefulness, setup/agent friction, install and path/platform
failures, unsupported-framework confusion, and user-reported false positives. Use explicit test
participants or controlled local sessions with consent. Collect structured notes manually; do not
add telemetry or transmit repository contents.

Acceptance does not require every user to like every message. It requires that unsafe certainty,
ambiguous mutation authority, silent installation, target-code execution, hidden networking, or a
version-binding bypass is not observed. Negative feedback and failed workflows remain in evidence.

## C. Agent integration validation

Test OpenAI Codex, Claude Code, Cursor, GitHub Copilot, Windsurf, Gemini CLI, Cline, Roo Code,
Continue, Goose, and Generic MCP independently against recorded host versions. Each host gets a
fresh project, a configured exact persistent runtime, then setup, status, removal, and restoration
tests. Host/model behavior is observational and never a deterministic product guarantee.

Natural prompts include:

```text
Check this project for security issues.
Review authentication and session security in this repository.
Are there authorization or tenant isolation problems here?
Check dependencies, secrets, and CI/CD security.
```

Also run unrelated prompts and ambiguous fix prompts as negative controls. Measure whether Cydetix
is selected, whether `cydetix_scan` (not mutation) is chosen for read-only requests, whether
`cydetix_fix` remains confirmation-gated, whether configuration survives setup/remove without
clobbering unrelated entries, whether exact runtime version/root binding is enforced, and whether
unrelated prompts avoid Cydetix. Capture host configuration diffs and tool transcripts after
redaction; record `SKIPPED_CAPABILITY` when a host cannot be tested.

## D. FastAPI resource-envelope investigation

Build a deterministic benchmark ladder from generated FastAPI repositories at 10, 50, 100, 250, 500,
1,000, and 2,500 modules, with controlled route/function/import/fact density. Add immutable subsets
of `fastapi/fastapi`, `full-stack-fastapi-template`, and the vulnerable FastAPI corpus case. Each
size runs one cold-cache warm-up and at least 20 measured repetitions on a fixed host.

Record file count, source bytes, functions, routes, facts, call-graph edges, identity/dataflow
facts, iterations, truncation reasons, elapsed p50/p95, peak RSS, normalized result hashes, and
crashes. Profile these stages separately before changing code:

1. repository discovery and bounded reads;
2. Python parsing and repeated syntax-tree walks;
3. fact/evidence indexing and report construction;
4. call-graph expansion;
5. identity propagation and dataflow iteration;
6. truncation/resource-bound accounting;
7. pathological fixture shape.

The root-cause report must attribute time and bounds to measured stages. An optimization is admitted
only when vulnerable, secure, false-positive-trap, ambiguous, malformed, and resource-bound fixtures
produce equivalent normalized semantics and repeated hashes. Faster output with dropped evidence,
different proof meanings, or nondeterminism is a failure.

## Proposed 1.1.0 scope (not implemented)

Preferred direction: **Python usefulness plus external validation**, gated by the campaign above.

1. Diagnose and improve Python/FastAPI resource behavior without changing result semantics or hiding
   truncation.
2. Admit at most one narrow FastAPI cross-file adapter: literal `FastAPI`/`APIRouter` decorator
   routes, statically named direct handlers, and statically resolvable repository-local Python
   imports. Exclude dependency injection, dynamic router construction, callbacks, re-export barrels,
   monkey patching, runtime middleware configuration, ORM policy inference, and arbitrary framework
   internals. Unsupported composition remains `UNKNOWN`.
3. Add resolved PyPI inventory/advisory support only for exact `requirements.txt` `==` pins and one
   separately validated lock format selected after fixture review. Editable, URL, VCS, marker,
   platform-conditional, unpinned, and conflicting requirements must remain partial/unknown rather
   than invented resolution.
4. Add independently reviewed Python corpus cases with immutable commits and findings-only labels;
   do not claim recall without complete ground truth.
5. Improve `UNKNOWN` explanations so unsupported import, router, dependency-injection, and
   resource-bound causes are distinct and actionable without implying vulnerability or safety.
6. Preserve strict rule admission and the existing SAFE ceiling. No new automatic remediation is in
   scope unless separately proven end to end and explicitly authorized.

Every proposed adapter/rule must define an exact security invariant and framework/API envelope and
ship a positive vulnerable fixture, secure negative, false-positive trap, ambiguous/`UNKNOWN` case,
malformed input, resource-bound case, deterministic repeated output, external validation where
feasible, and explicit remediation ceiling. “FastAPI support” without this subset is forbidden.

## Decision gate

The next engineering decision is made only after the FastAPI benchmark/root-cause report and first
wave corpus ledger are complete. Select or reject the one adapter and one PyPI lock format from
measured evidence; do not begin broad Python implementation in parallel with diagnosis.
