# Rule expansion plan

Rule expansion proceeds through reusable deterministic primitives and admission evidence, not
isolated keyword checks.

## Batch 1 architecture

The bounded application engine models source, propagation, transformation, contextual security
control, sink, reachability, and an ordered evidence path. Its first support envelope covers
high-confidence JavaScript/TypeScript and Python server patterns for SQL injection, OS command
injection, path traversal, and SSRF.

The analysis understands direct assignment, aliases, object properties, template strings, string
concatenation, arrays/objects, same-file function arguments and deterministically resolvable
returns, selected preserving wrappers, and contextual controls. Import and framework provenance
prevent a same-named custom function from becoming a sink. Static unreachable branches are excluded;
unresolved dynamic behavior becomes incomplete analysis.

This is not an unbounded whole-program taint engine. Current bounds are published by
`cydetix trust`: 50,000 AST nodes per file, 200,000 per repository analysis, 10,000 tracked facts,
eight propagation iterations, and sixteen evidence steps. Hitting a bound emits `TRUNCATED` and
withholds Batch 1 proof.

## Admission sequence

For each rule:

1. define the invariant, prerequisite, impact, and standards provenance;
2. review exact source, sink, framework, and contextual-control models;
3. implement reusable bounded propagation;
4. add positive, negative, adversarial, unknown/incomplete, cross-function, framework-specific,
   control, and near-miss fixtures;
5. verify stable evidence and fingerprints;
6. test truncation and parser-failure behavior;
7. document false-positive analysis and unsupported cases;
8. justify the remediation ceiling and invariant verifier; and
9. assign maturity only after the admission gate passes.

## Controlled external corpus

Ordinary tests use repository-owned static fixtures and never download or execute a target project.
Any future external corpus must be separately approved, pinned to an immutable revision, hash and
record provenance, be acquired outside the ordinary test path, remain static data, and be evaluated
per rule. Results must report true positives, negative/adversarial outcomes, unsupported cases, and
observed false positives separately. Aggregate accuracy claims without a justified denominator are
not accepted.

## Future batches

Later work may add narrowly reviewed cross-file propagation, more framework adapters, and richer
controls. Each increment must preserve explicit UNKNOWN, deterministic bounds, hostile-repository
safety, and the remediation ceiling. No future breadth is implied by the current catalogue.
