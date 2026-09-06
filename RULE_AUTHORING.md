# Rule authoring

## Acceptance contract

A rule is incomplete until all of the following exist:

1. A schema-valid definition with unique ID/version, title/category, severity, confidence, standards
   mappings, language/framework scope, detection strategy, evidence requirements, reachability
   method, invariant, prerequisite, impact, remediation, references, and autofix class.
2. Concrete repository evidence and a bounded source location. Do not infer a high-confidence
   vulnerability from package presence alone.
3. At least one deliberately vulnerable fixture and one secure negative fixture.
4. Unit and integration assertions, including redaction and golden-output updates when relevant.
5. A coverage limitation for important cases the detector does not understand.
6. For a repository rule, an explicit tri-state proof contract, an ordered cross-file evidence path,
   resource bounds, and false-positive traps for ambiguous or unsupported control/data flow.

## IDs and versions

Use `AS-<DOMAIN>-NNN`. Increment the rule semantic version when meaning, evidence, precision, or
fingerprint behavior changes. Breaking rule-schema changes require a new public schema version.

## Detection guidance

Prefer AST identity and exact configuration structure. Regex is acceptable for constrained
configuration, lexical secret markers, and syntax already validated by a parser. Bound multiline
patterns to prevent pathological scans. Never execute or import target modules.

Cross-file rules must consume validated Security IR or another versioned repository contract. They
must not reopen files, infer runtime imports, or turn absence of evidence into proof of a defect.
When import resolution, dispatch, identity provenance, enforcement, or resource selection is
ambiguous, emit an `UNKNOWN` proof or coverage limitation rather than a vulnerability finding.

An authorization rule may emit `VIOLATED` only when its documented invariant, attacker control,
trusted subject/tenant context, route reachability, resource operation, and missing/unsafe
enforcement are all supported by concrete repository evidence. A `PROVEN` result is narrowly scoped
to the modeled selector/policy; it is not a declaration that the route is universally secure.

Distinguish:

- severity: consequence if the invariant is broken;
- confidence: strength of evidence that the invariant is broken;
- reachability: evidence that an attacker can reach the affected path.

## Standards

Map only requirements directly supported by the invariant. Current identifiers use OWASP Top
10:2025, ASVS 5.0.0, CWE IDs, and NIST SP 800-63B-4 sections where relevant. A mapping is
traceability, not a compliance certification.

## Remediation

Default to `ARCHITECTURAL` unless a patch is local, deterministic, behavior-preserving under stated
assumptions, and strongly verifiable. `REVIEW_REQUIRED` plans may describe an exact candidate patch,
but must not be silently applied. Follow [AUTOFIX_POLICY.md](AUTOFIX_POLICY.md).

A SAFE adapter is incomplete until it defines and tests:

1. Applicability and exact parsed vulnerable-state preconditions.
2. A bounded transformation whose complete affected-file set is known before mutation.
3. Whole-file and vulnerable-range stale checks plus a stable finding identity independent of line
   movement.
4. The security invariant and required before/after conclusions.
5. Parser, rescan, and invariant verification stages and the declared verification scope.
6. A rollback strategy that restores only VibeShield's own bytes and preserves unrelated work.
7. Idempotency: a second invocation makes no change and creates no duplicate configuration.
8. Secure-negative, false-positive, stale, dirty-tree, rollback, path/symlink, formatting, and
   secret-redaction fixtures where applicable.

Transformation implementations must use structural parser evidence for source code and exact config
structure for data formats. Complex edits may not use arbitrary regex replacement. An
engine-produced finding does not authorize repository commands, formatters, plugins, hooks, or
package managers. Any optional command verification is supplied explicitly by the operator and is
not part of a SAFE proof unless it succeeds alongside the deterministic invariant rescan.

Object authorization, tenant isolation, roles, permissions, and business-policy repairs are
`ARCHITECTURAL` unless a future rule demonstrates a behavior-preserving proof. They must never be
silently autofixed.

Secret remediation must enumerate incident components instead of treating source removal as full
resolution. Dependency and Action-pin remediation must retain authoritative version/SHA and
lockfile/workflow semantics as REVIEW_REQUIRED. SARIF fixes are permitted only for an exact SAFE
replacement with a real artifact location.

After editing the catalogue:

```powershell
npm run build
npm run schemas
npm run verify
```
