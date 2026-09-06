# VibeShield CLI contract

## Primary commands

| Command            | Mutation           | Behavior                                                                                  |
| ------------------ | ------------------ | ----------------------------------------------------------------------------------------- |
| `vibeshield`       | None               | Scans the current project with applicable deterministic engines and concise human output  |
| `vibeshield fix`   | SAFE only          | Rescans, applies only approved SAFE fixes, verifies, rescans, and reports residual issues |
| `vibeshield setup` | Integration config | Detects and configures supported AI coding agents                                         |

The default scan needs no `init`, configuration file, account, key, cloud service, global install,
Docker daemon, or engine selector. New config uses `.vibeshield.json`; the legacy
`.invariantsec.json` filename remains readable for migration.

`fix` itself is explicit mutation intent. `--dry-run` emits plans/diffs with zero source writes.
`REVIEW_REQUIRED` and `ARCHITECTURAL` plans are never applied. `--safe` remains only as a backwards-
compatible alias and cannot widen engine policy.

`setup` configures only detected environments unless `--agent <name>` or `--all` is supplied. In a
non-interactive session, writes require `--yes`. `--dry-run` previews and `--uninstall` removes only
managed entries.

## Default output and expert formats

The default human report prioritizes `FIX NOW`, `REVIEW`, and `UNKNOWN`. Canonical severity,
confidence, proof/reachability state, evidence, standards mappings, and stable rule IDs remain in
structured reports.

```bash
vibeshield --details
vibeshield --json
vibeshield --sarif
```

## Advanced usage

```bash
vibeshield scan . --offline --format text
vibeshield auth . --format text
vibeshield graph . --auth --format json
vibeshield dependencies . --advisories offline --format json
vibeshield secrets . --history --format json
vibeshield supply-chain . --advisories offline --format text
vibeshield sbom . --format json
vibeshield fix . --dry-run --format json
vibeshield remediation show remediation.json --format text
vibeshield verify .
vibeshield explain AS-SESSION-001
vibeshield standards
vibeshield ci . --format sarif --fail-on high
vibeshield doctor
vibeshield version
```

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
