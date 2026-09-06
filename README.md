# VibeShield

> **PUBLIC ALPHA CANDIDATE — NOT PUBLISHED**
>
> Version `0.6.0-alpha.1`. No npm package, GitHub release, plugin, or marketplace listing has been
> published by this repository.

VibeShield is a zero-config, local-first security CLI for application code, authentication,
authorization, secrets, dependencies, supply chain, and CI/CD. Its scanner is deterministic, offline
by default, needs no account or API key, and treats every scanned repository as untrusted.

> **Name warning:** `VibeShield` already has active uses in the security market. The name is not
> represented as exclusive, legally cleared, or trademark-safe. The exact unscoped npm name was
> unregistered when checked on 2026-09-06, but that observation is not a reservation or permission
> to publish. Publication remains blocked until the identity conflict is explicitly reviewed.

## With an AI coding agent

After an authorized npm release:

```bash
npx vibeshield setup
```

Then ask naturally:

```text
Check this project for security issues.
```

After one-time setup, supported AI coding agents can automatically invoke VibeShield when a
security-related request is detected. Host behavior remains probabilistic and host-controlled;
automatic invocation is not guaranteed.

## Without an AI coding agent

```bash
npx vibeshield
```

VibeShield scans the current project with sensible safe defaults. No `init`, config file, global
install, account, key, cloud service, Docker daemon, username, organization, or package scope is
required for ordinary read-only scanning.

Global installation is optional:

```bash
npm install -g vibeshield
vibeshield
```

The commands above describe the intended public package identity. Until publication is explicitly
authorized and the live registry artifact is verified, use only a reviewed local tarball produced
from this repository.

## Simple command model

```bash
vibeshield
vibeshield fix
vibeshield setup
```

- `vibeshield` detects the current project, runs only applicable analysis, correlates findings, and
  prints a concise decision-oriented result.
- `vibeshield fix` is explicit fix intent. It rescans, applies only engine-classified `SAFE`
  transformations, verifies them, rescans, and reports proof. `REVIEW_REQUIRED` and `ARCHITECTURAL`
  work is never silently applied.
- `vibeshield setup` detects supported coding agents and configures version-pinned local stdio MCP
  plus one `vibeshield` security skill. Use `--dry-run` to preview and `--uninstall` to remove only
  managed entries.

Use `vibeshield fix --dry-run` to inspect remediation without source writes.

## Output

Human output prioritizes `FIX NOW`, `REVIEW`, and `UNKNOWN`. The underlying report retains canonical
severity, confidence, reachability/proof evidence, stable rule IDs, and remediation classes.

```bash
vibeshield --details
vibeshield --json
vibeshield --sarif
```

The default view omits large evidence chains, CWE/ASVS mappings, Security IR, SARIF internals,
benchmarks, and provider details. The flags above expose expert evidence without weakening UNKNOWN
semantics.

## Supported agent adapters

Initial adapters cover:

- OpenAI Codex and the shared ChatGPT/Codex local MCP configuration
- Claude Code
- Cursor
- GitHub Copilot surfaces that consume repository skills/instructions and VS Code MCP configuration
- Windsurf
- generic MCP-compatible clients

Setup configures only detected agents unless `--agent <name>` or `--all` is explicit. Generated MCP
commands pin `vibeshield@0.6.0-alpha.1`; they do not silently track arbitrary future versions. Rerun
`npx vibeshield@latest setup` only when you explicitly want to review and install an update. Offline
MCP startup requires the pinned package to remain available in the npm cache.

The host controls whether a tool is enabled, approved, or invoked. Cursor, Claude, Copilot,
Windsurf, and generic MCP clients retain their own approval and repository-security models.

## Agent permission boundary

- Read-only scan and explanation may run implicitly for relevant security requests.
- A question about possible fixes may produce a dry-run plan.
- Source modification requires explicit user fix/remediate intent.
- MCP source changes additionally require the explicit confirmation field and can enter only the
  deterministic engine's `SAFE` transaction path.
- `REVIEW_REQUIRED` requires review.
- `ARCHITECTURAL` is never silently applied.
- Agents cannot authorize repository scripts, external verification commands, sandbox bypasses, or
  remediation reclassification through the MCP layer.

VibeShield findings remain the source of truth. An agent must not invent unsupported findings or
convert UNKNOWN into a conclusion without separate evidence.

## Advanced usage

The expert command surface remains available:

```bash
vibeshield scan . --offline --format text
vibeshield auth . --format text
vibeshield graph . --auth --format json
vibeshield dependencies . --advisories offline --format json
vibeshield secrets . --history --format json
vibeshield supply-chain . --advisories offline --format text
vibeshield sbom . --format json
vibeshield fix . --dry-run --format json
vibeshield ci . --format sarif --fail-on high
vibeshield doctor
```

The legacy `invariantsec` binary alias and `.invariantsec.json` configuration filename remain
accepted for migration compatibility. New configuration uses `.vibeshield.json`. Stable `AS-*`
security rule IDs are unchanged.

## Security and limitations

Ordinary scanning does not execute repository code, lifecycle scripts, hooks, builds, tests,
containers, or repository instructions. Traversal is bounded, does not follow symlinks, skips
archives and oversized/binary files, and canonicalizes paths. Secret evidence is redacted.

VibeShield does not certify a project as secure or production-ready. It supports bounded JavaScript,
TypeScript, Python, Express/Prisma, npm lockfile, GitHub Actions, and authentication patterns.
Unsupported or inconclusive behavior remains UNKNOWN or uncovered. Local trusted verification is not
a sandbox; container verification is optional, explicit, and fail-closed.

Read [Security model](docs/SECURITY_MODEL.md), [threat model](THREAT_MODEL.md),
[autofix policy](AUTOFIX_POLICY.md), [validation](docs/VALIDATION.md), and
[limitations](docs/LIMITATIONS.md) before relying on the alpha in a sensitive workflow.

## Development

Supported runtimes are Node.js `22.18+` within Node 22 and `24.11+` within Node 24.

```bash
npm ci --ignore-scripts
npm run build
npm test
npm run verify
npm run validate:install
```

`npm run validate:install` packs the actual npm artifact, installs it into isolated local and global
prefixes, exercises the `vibeshield` launcher, default scan, setup, MCP, expert commands, and the
single packaged skill. Source-tree execution alone is not treated as npm UX proof.

No publication action is performed by these commands. See
[zero-friction UX handoff](docs/ZERO_FRICTION_UX_HANDOFF.md) and
[publication gate](docs/PUBLICATION_GATE_FINAL.md).
