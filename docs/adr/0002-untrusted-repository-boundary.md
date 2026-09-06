# ADR 0002: Treat repositories as hostile data

- Status: accepted
- Date: 2026-08-30

## Decision

Normal analysis uses filesystem APIs only. It does not import target modules, run package managers,
invoke build tools, execute hooks, follow symlinks, unpack archives, or make network requests.

Traversal is iterative and bounded by file count, depth, and file size. Each candidate is checked
with `lstat`, canonical containment is verified before reading, binary files are skipped, and report
paths are repository-relative. Configuration is size-bounded, schema-validated data and cannot add
commands. Source text is evidence, never an instruction channel.

Fix mode is a distinct explicit operation. It accepts only engine-produced byte-range replacements,
checks the original content fingerprint, rejects symlinks and out-of-root paths, writes only regular
files inside the selected root, and rescans after mutation.

## Consequences

Coverage is intentionally lower for generated routes, runtime configuration, metaprogramming, and
framework behavior that requires execution. Reports must expose those limitations. Dynamic analysis
remains ROADMAP and will require a separate sandbox design.
