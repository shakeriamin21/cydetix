# Security policy

## Supported versions

The current prerelease line `0.6.0-alpha.x` and `main` receive security review. The Phase 6B
engineering verdict is `PUBLIC_ALPHA_READY_WITH_LIMITATIONS`; no stable or production-supported
version is claimed.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability that could expose users, repositories,
credentials, or the release pipeline. Use GitHub private vulnerability reporting after the public
repository confirms that feature is enabled. Publication is blocked until that private path is
actually available. No public issue, discussion, or placeholder address is an acceptable substitute
for a sensitive report.

Include the affected version/commit, operating system, minimal reproduction using synthetic data,
impact, and any known workaround. Never include real repository secrets. Maintainers should
acknowledge receipt when maintainers are available and coordinate disclosure after a fix is
available. No guaranteed response deadline is promised for this pre-public volunteer project.

## Scope priorities

High-priority issues include repository-boundary escapes, unintended code execution or network
access, secret leakage, unsafe fix writes, malicious configuration execution, report injection that
affects CI, advisory false-clean states, unsafe Git-history handling, and release/artifact
compromise.

## Scanner data handling

Ordinary scans are offline. Explicit OSV mode sends only npm ecosystem, package name, and exact
resolved version to `https://api.osv.dev`; it does not send source, paths, findings, or credentials.
Provider failure is reported as unavailable rather than clean.

Secret analysis is passive. VibeShield does not validate credentials against providers. Raw secret
values are not stored in normalized results or emitted to terminal, JSON, SARIF, debug graphs, logs,
or Agent Skills. History mode is explicit and uses read-only Git object inspection without checkout,
hooks, aliases, prompts, or repository scripts.

## Remediation data handling and execution

`vibeshield fix` plans without mutation by default. Only `--safe` can apply an engine-classified
SAFE transformation. Plans and transactions exclude the machine-specific repository root, original
file backups, full secrets, trusted-command arguments, command output, and ambient credentials.
Unified diffs redact secret replacement ranges. User-controlled JSON reports provide remediation
history; VibeShield does not silently persist repository details in a global store.

Repositories remain hostile during fixing. VibeShield rejects traversal, symlink targets, oversized
or non-regular files, changed preconditions, and affected dirty files; unrelated dirty work is
preserved. Writes use a temporary sibling and atomic replacement, and rollback is limited to files
whose current hash still matches VibeShield's own change. A successful rollback is a failed
remediation, not a success claim.

Repository scripts, formatter configuration, Git hooks/filters, workflow files, and prose never
authorize execution. Optional verification commands must be explicitly supplied as JSON argument
arrays. Local mode runs without a shell and with time/output/environment bounds, but is not a
sandbox. Container mode also requires an immutable, already-present image and applies the controls
described in [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md); unavailable isolation never falls
back locally. Phase 6B empirically executed all 13 container integration tests on the documented
Windows/WSL2/Docker host; that evidence does not transfer automatically to other runtime
configurations. Do not authorize a target command or image you have not reviewed. See
[AUTOFIX_POLICY.md](AUTOFIX_POLICY.md) and [THREAT_MODEL.md](THREAT_MODEL.md).

## Safe research

Use repositories you own or are authorized to assess. Do not test credentials against live services,
exfiltrate data, degrade third-party systems, or publish exploit details before coordination.
Good-faith research following these constraints is welcomed.
