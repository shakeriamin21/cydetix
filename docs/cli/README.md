# Cydetix CLI contract

## Primary commands

| Command         | Mutation           | Behavior                                                                                  |
| --------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| `cydetix`       | None               | Scans the current project with applicable deterministic engines and concise human output  |
| `cydetix fix`   | SAFE only          | Rescans, applies only approved SAFE fixes, verifies, rescans, and reports residual issues |
| `cydetix setup` | Integration config | Detects and configures supported AI coding agents                                         |

The default scan needs no `init`, configuration file, account, key, cloud service, global install,
Docker daemon, or engine selector. Optional configuration uses `.cydetix.json`; no unpublished
candidate filename or CLI alias is retained.

`fix` itself is explicit mutation intent. `--dry-run` emits plans/diffs with zero source writes.
`REVIEW_REQUIRED` and `ARCHITECTURAL` plans are never applied.

After a normal interactive scan, Cydetix can offer one consent prompt for detected unconfigured
hosts. It never prompts in CI, MCP, agent subprocesses, pipes, or non-interactive shells. Explicit
`setup` configures only detected environments unless `--agent <name>` or `--all` is supplied. In a
non-interactive session, writes require `--yes`. `--dry-run` previews, `--status` inspects,
`--verify` checks, and `--remove` removes only Cydetix-owned entries.

## Default output and expert formats

The default human report prioritizes `FIX NOW`, `REVIEW`, and `UNKNOWN`. Canonical severity,
confidence, proof/reachability state, evidence, standards mappings, and stable rule IDs remain in
structured reports.

```bash
cydetix --details
cydetix --json
cydetix --sarif
```

## Advanced usage

```bash
cydetix scan . --offline --format text
cydetix auth . --format text
cydetix graph . --auth --format json
cydetix dependencies . --advisories offline --format json
cydetix secrets . --history --format json
cydetix supply-chain . --advisories offline --format text
cydetix sbom . --format json
cydetix fix . --dry-run --format json
cydetix remediation show remediation.json --format text
cydetix verify .
cydetix explain AS-SESSION-001
cydetix standards
cydetix ci . --format sarif --fail-on high
cydetix doctor
cydetix doctor --agent --project-root .
cydetix version
```

`scan <path> --format json --non-interactive` is the strict agent subprocess contract: stdout is a
single newline-terminated JSON payload, diagnostics use stderr, stdin/TTY is never required, and no
automatic integration setup runs. Persistent setup-generated integrations invoke the canonical Node
executable and installed JS entrypoint directly; they do not rely on PATH, npm, npx, a shell
profile, or network access.

Each `--verify-command` value is an explicitly authorized non-empty JSON string array. It is invoked
directly with no shell, fixed repository cwd, stripped environment, no stdin, a timeout, and bounded
output. Repository files and prose cannot authorize execution. Local commands are trusted execution,
not a sandbox; container verification is a separate explicit option.

## Exit codes

- `0`: successful operation with no applicable policy result.
- `1`: active findings or unapplied plans remain.
- `2`: invalid arguments or configuration.
- `3`: scanner/tool failed safely.
- `4`: verification, rollback, stale-finding, or rescan failure.
- `5`: at least one SAFE fix reached `APPLIED_VERIFIED`.
- `6`: requested mutation is review-required, architectural, or otherwise unapproved.
- `7`: an explicitly required provider is unavailable.

`scan` reports findings without treating them as a failing policy; use `ci` or `verify` for gates.

## Safety guarantees

Ordinary scanning does not execute repository code. Paths are repository-relative, secret evidence
is redacted, symlinks are not followed, and traversal is bounded. Unsupported provider and proof
states remain `NOT_CHECKED_OFFLINE`, `PROVIDER_UNAVAILABLE`, or `UNKNOWN` rather than becoming clean
results. SARIF fixes exist only for exact SAFE replacements.

Remediation is hash-guarded and transactional. Dirty/stale targets are refused; verification or
rescan failure triggers conditional rollback. Only `APPLIED_VERIFIED` proves the intended invariant
transitioned from insecure to secure.
