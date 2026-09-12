# Alpha.11 Batch 2 external-corpus validation

Date: 2026-09-12

The eleven repositories in `ALPHA11_BATCH2_EXTERNAL_CORPUS_MANIFEST.json` were checked out at exact
commits and scanned twice with a fixed clock. Cydetix read source statically. No target application,
test, build, package manager, lifecycle script, environment file, or dependency code was executed,
and no target dependency was installed.

## Final results after corrections

| Rule                    | Confirmed TP | Confirmed FP | Expected UNKNOWN | Supported-pattern FN |
| ----------------------- | -----------: | -----------: | ---------------: | -------------------: |
| `AS-XSS-001@1.0.0`      |            6 |            0 |                6 |                    0 |
| `AS-REDIRECT-001@1.0.0` |            0 |            0 |                0 |                    0 |
| `AS-CSRF-001@1.0.0`     |            2 |            0 |              165 |                    0 |

The table is not an accuracy percentage. UNKNOWN counts include each relevant unresolved route or
control instance in the scan output. Oversized Fastify and Juice Shop snapshots reached explicit
resource limits and were `TRUNCATED`; their incomplete analysis produced no actionable Batch 2
proof.

## Actionable finding proof audit

All eight actionable findings were manually checked in the pinned source.

| Rule | Repository and path                             | Source                              | Bounded path and context                          | Sink / missing control                                                             | Verdict |
| ---- | ----------------------------------------------- | ----------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------- | ------- |
| XSS  | Vikas vulnerable website `server/server.js:148` | `req.query.search`                  | two local template/assignment steps; HTML body    | `res.send` at line 170; no encoding/sanitization                                   | TP      |
| XSS  | Vikas vulnerable website `server/server.js:174` | `req.body.comment`                  | two local template/assignment steps; HTML body    | `res.send` at line 197; no encoding/sanitization                                   | TP      |
| XSS  | Vikas vulnerable website `server/server.js:203` | `req.query.recipient`               | two local template/assignment steps; HTML body    | `res.send` at line 228; no encoding/sanitization                                   | TP      |
| XSS  | Vikas vulnerable website `server/server.js:234` | `req.body.recipient`                | two local template/assignment steps; HTML body    | `res.send` at line 259; no encoding/sanitization                                   | TP      |
| XSS  | Vikas vulnerable website `server/server.js:263` | `req.body.url`                      | two local template/assignment steps; HTML body    | `res.send` at line 302; no encoding/sanitization                                   | TP      |
| XSS  | breakableflask `main.py:454`                    | `request.form`                      | four local formatting/assignment steps; HTML body | `render_template_string` at line 468 with attacker data already in template source | TP      |
| CSRF | Vikas vulnerable website `server/server.js:79`  | preceding global session-auth guard | literal protected POST route at line 117          | no route-bound token or origin control                                             | TP      |
| CSRF | Vikas vulnerable website `server/server.js:79`  | preceding global session-auth guard | literal protected POST route at line 231          | no route-bound token or origin control                                             | TP      |

Every finding was `PROVEN_INSECURE`, high confidence, complete at the finding path, likely
reachable, and capped at `REVIEW_REQUIRED`. No automatic fix was offered.

## Defect found and corrected

The first corpus pass left five Vikas protected POST routes UNKNOWN because inline route callbacks
and a preceding structural `app.use` session-auth guard were not correlated. The engine was extended
only for this exact Express shape. Review then exposed two overbroad assumptions: assigning
`req.session.loggedin` in the login route was not ambient-credential reliance, and POST alone was
not proof of a state-changing action. The final model requires a session read, a structurally
resolved mutation or provenance-backed filesystem/process action, and a missing origin control. This
kept only the command execution and session-balance mutation actionable. Positive global-middleware,
negative session-establishment, and read-only fixtures cover the corrections. The complete corpus
was then rerun twice. An aggregate-fixture replay subsequently showed SameSite evidence from an
unrelated module affecting other routes in the same package. SameSite evidence is now bound to a
preceding middleware call on the same receiver in the same module; an aggregate regression covers
the boundary, and the complete eleven-repository paired corpus was rerun again with unchanged final
results.

## Unsupported and UNKNOWN review

- NodeGoat and DVNA use CommonJS or controller-separated route/handler composition outside the
  admitted application-dataflow provenance envelope. Their dynamic redirects were not counted as
  false negatives.
- Juice Shop's redirect uses an application-specific policy wrapper and complex exported-handler
  composition. Cydetix does not infer that policy's sufficiency.
- Express framework examples with internal package receivers or `req.get("Referrer")` are outside
  the supported source/provenance shapes. Fixed redirect examples are non-applicable.
- SameSite-only, unresolved handler, custom authentication, and opaque transformation cases remain
  UNKNOWN. Ordinary Next/React completed with zero findings and zero UNKNOWN; its JSX and fixed
  redirects are secure/non-applicable within the checked patterns.
- A state-changing GET and dynamic method/router semantics are documented outside the CSRF proof
  envelope; only supported POST, PUT, PATCH, and DELETE route shapes are admitted.

Manual source search of every selected repository found no remaining unreported instance inside the
declared source, sink, control, provenance, reachability, and resource envelope. Unsupported cases
are not described as false negatives.

## Determinism

Every repository produced byte-equivalent Batch 2 findings, completeness, application-dataflow
analysis, and catalogue/configuration/suppression fingerprints across its paired scans. The final
catalogue fingerprint was `33af95ab490dce9be35d0c5926e66be2b9e49496a8fa1404af0f70fd495a4bec`.

Verdict: PASS
