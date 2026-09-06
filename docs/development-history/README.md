# Public capability history

Cydetix was developed through a sequence of internal engineering gates before its first public
source commit. The private handoff documents are intentionally excluded from the public repository:
they duplicated public documentation and included internal branches, commit topology, local
environment details, stale release experiments, and process notes that users do not need.

The technical record remains available in public-useful form:

- `CHANGELOG.md` records shipped capabilities by version;
- `docs/VALIDATION.md` records test methods, corpus denominators, sandbox evidence, and non-pass
  states;
- `docs/CLAIMS.md` maps public claims to evidence;
- `docs/SECURITY_MODEL.md`, `THREAT_MODEL.md`, and `docs/LIMITATIONS.md` describe boundaries and
  residual risk;
- `validation/`, `fixtures/`, `schemas/`, and `rules/` retain reproducible machine-readable inputs.

The sequence of capability work was: deterministic static analysis, bounded cross-file authorization
reasoning, authentication invariants, supply-chain analysis, transactional remediation, adversarial
validation, empirical container isolation, and controlled public-release engineering. This summary
does not imply that every capability supports every language or framework; current scope is defined
only by `SUPPORT_MATRIX.md` and the public claims documents.

Removing internal handoffs does not alter their historical test results or claim that hosted checks
ran earlier than they did.
