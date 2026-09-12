# SAFE fix admission

`SAFE` is a security guarantee, not a coverage metric. Rule authors declare `maxRemediationClass`;
runtime assessment can keep that class or make it more conservative, never less conservative.

| Author ceiling    | Runtime outcomes permitted                 |
| ----------------- | ------------------------------------------ |
| `SAFE`            | `SAFE`, `REVIEW_REQUIRED`, `ARCHITECTURAL` |
| `REVIEW_REQUIRED` | `REVIEW_REQUIRED`, `ARCHITECTURAL`         |
| `ARCHITECTURAL`   | `ARCHITECTURAL`                            |

Verification strength cannot promote semantic safety. Severity is independent of remediation class.

## Required SAFE evidence

A SAFE assessment requires all of the following:

- deterministic transformation;
- bounded local blast radius;
- source text and hash verified immediately before mutation;
- no business-policy decision;
- no authorization-policy invention;
- no architecture change;
- no unresolved semantic ambiguity;
- no UNKNOWN security dependency; and
- independent post-fix invariant verification.

Any missing condition downgrades the assessment. Cydetix reports the ceiling, requested and final
classes, every SAFE condition, verification strength, and sorted reason codes.

## Reason codes

The runtime currently defines:

- `EXACT_LOCAL_TRANSFORM`
- `DYNAMIC_EXPRESSION`
- `AMBIGUOUS_SEMANTICS`
- `BUSINESS_POLICY_REQUIRED`
- `AUTHORIZATION_POLICY_REQUIRED`
- `SCHEMA_CHANGE_REQUIRED`
- `CROSS_MODULE_UNCERTAINTY`
- `UNSUPPORTED_FRAMEWORK_PATTERN`
- `INSUFFICIENT_DATAFLOW_PROOF`
- `SANITIZER_UNKNOWN`
- `VERIFICATION_INSUFFICIENT`
- `MULTI_FILE_SEMANTIC_CHANGE`
- `ARCHITECTURE_CHANGE_REQUIRED`

The existing session-cookie literal transform remains the sole SAFE adapter. It uses an exact local
edit, source-hash precondition, parser validation, targeted rescan, invariant reevaluation, and
transaction rollback. Every Batch 1 and Batch 2 rule has a `REVIEW_REQUIRED` ceiling: Cydetix does
not invent SQL parameter contracts, command argument semantics, authorized filesystem roots, network
or redirect allowlists, output-context transformations, or application CSRF architecture.
