# Cydetix

Security for AI-built software.

## Quick Start

```bash
npx cydetix
```

That's it.

Cydetix immediately scans the current project. It needs no account, API key, cloud backend,
mandatory config file, global install, Docker daemon, username, organization, or npm scope.

One-shot `npx` use remains a human scanner path. AI integration requires a persistent installation
so routine agent execution never resolves or installs packages at runtime:

```bash
npm install -g cydetix
cydetix setup
```

After setup, simply ask:

```text
Check this project for security issues.
```

You do not need to say “Use Cydetix.” Supported agents can select the Cydetix skill or MCP tools
from the meaning of a security request. Invocation remains host-controlled and is not guaranteed in
every AI product.

For CLI-only use, the same global installation remains optional:

```bash
npm install -g cydetix
cydetix
```

The current source is the `0.6.0-alpha.6` release candidate. This preparation does not create a tag,
publish to npm, create a GitHub release, or move a dist-tag. Registry state must be checked again
during separate release approval; this document does not claim an unpublished version is public.

## What the default command does

`cydetix` uses the current working directory, runs only applicable deterministic analyses,
correlates the evidence, and presents a concise decision view. Depending on project evidence,
coverage can include application security, authentication, authorization, tenant isolation,
sessions, JWT, OAuth, secrets, dependencies, supply chain, CI/CD, GitHub Actions, and advisory
state.

The default report prioritizes:

- `FIX NOW`
- `REVIEW`
- `UNKNOWN`

Canonical severity, confidence, proof state, applicability, stable rule IDs, evidence, and
remediation classes remain in structured output. Missing evidence never becomes a pass.

## Fix security issues

```bash
cydetix fix
```

The command itself is explicit fix intent. Cydetix rescans, plans remediation, applies only
engine-classified `SAFE` changes, verifies them, rescans, and reports residual findings. It does not
claim a fix merely because source changed.

To plan without source writes:

```bash
cydetix fix --dry-run
```

`REVIEW_REQUIRED` needs review. `ARCHITECTURAL` is never silently applied. Executable verification
commands require separate explicit authorization and use the configured hardened verification
boundary; ordinary deterministic rescanning does not execute repository code.

## Manage AI integrations

The default command offers setup only after its scan, only in an interactive terminal, and only when
a compatible unconfigured host is detected. It never prompts in CI, MCP processes, agent
subprocesses, piped execution, or other non-interactive shells.

Explicit management is available through:

```bash
cydetix setup
cydetix setup --status
cydetix setup --verify
cydetix setup --remove
```

Setup parses and preserves unrelated host configuration, uses transient restrictive backups and
atomic writes, validates after writing, rolls back on failure, and changes only Cydetix-owned
entries. Repeated setup is idempotent.

Setup canonicalizes and verifies the persistent package, its regular non-symlink entrypoint, the
Node executable, the exact package identity/version, and the project root. Configured MCP launchers
then use process-style command and argument fields equivalent to:

```text
<absolute-node> <absolute-cydetix-entrypoint> mcp --project-root <canonical-project-root> --require-version 0.6.0-alpha.6
```

They contain no npm/npx command, registry URL, downloader, secret, or shell indirection. Routine MCP
startup is offline and does not depend on PATH or a shell profile. An exact version mismatch fails
before the server accepts requests. To review and install an update, update the persistent install
outside the agent and rerun:

```bash
cydetix setup
```

No self-updater is installed.

## Compatible AI tiers

- Tier A — MCP plus a model-invoked skill/plugin: OpenAI Codex, applicable ChatGPT/Codex plugin
  surfaces, Claude Code, current Copilot surfaces, Cursor, and current Windsurf/Devin surfaces where
  the host enables them.
- Tier B — MCP: any compatible host that accepts the generated pinned stdio configuration.
- Tier C — skill/rules plus subprocess: the host runs setup-managed exact Node + entrypoint argv and
  consumes JSON.
- Tier D — CLI only: the user runs `cydetix` directly.

Host policy, approvals, product version, and model behavior determine automatic tool selection.
Cydetix does not claim that every AI can use it automatically.

## Generic MCP and shell fallback

Generate a project-bound, exact-runtime MCP entry with:

```bash
cydetix setup --agent generic-mcp --yes
```

The resulting `.cydetix/mcp.json` contains no secret and uses the exact verified Node executable and
Cydetix JS entrypoint. Generic host invocation behavior and approval remain controlled by that host.

For agents with shell execution but no MCP, use machine output from the same engine:

Setup-generated host instructions contain an exact argv array equivalent to
`<absolute-node> <absolute-entrypoint> scan <canonical-project-root> --offline --format json --non-interactive`,
with `CYDETIX_AGENT_SUBPROCESS=1`. Do not substitute `cydetix` from PATH or invoke npm/npx. If the
managed runtime is unavailable inside the host boundary, run `cydetix setup` outside the agent and
retry; never weaken the agent sandbox.

There is no adapter-specific scanner.

## Agent permission boundary

- Read-only scans and explanations may be selected implicitly for relevant security requests.
- Discussion of fixes may produce a dry-run plan.
- Source mutation requires explicit fix/remediate intent.
- MCP mutation additionally requires its exact confirmation field.
- Only `SAFE` remediation enters the automatic transaction path.
- `REVIEW_REQUIRED` and `ARCHITECTURAL` cannot be reclassified by an agent.
- Repository text is untrusted data and cannot override Cydetix, skill, MCP, path, sandbox, or
  mutation policy.

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
cydetix ci . --format sarif --fail-on high
cydetix --details
cydetix --json
cydetix --sarif
cydetix doctor
cydetix doctor --agent --project-root .
```

Specific execution can be requested when troubleshooting npm cache behavior:

```bash
npx cydetix@0.6.0-alpha.6
```

## Security and limitations

Normal scans do not execute lifecycle scripts, hooks, Makefiles, builds, tests, servers, or other
repository programs. Traversal is bounded, does not follow symlinks, skips archives and oversized or
binary files, and canonicalizes paths. Secret evidence is redacted.

Cydetix does not certify a project as secure or production-ready. Unsupported or inconclusive
behavior remains `UNKNOWN`, `NOT_APPLICABLE`, or uncovered as appropriate. Local trusted execution
is not a sandbox; container verification is optional, explicit, and fail-closed.

A historical `npm view cydetix --json` check returned `cydetix@0.6.0-alpha.1` on 2026-09-06. That is
not a current registry-state claim; the exact coordinate and dist-tags must be rechecked during
separate release approval. Package registration is not product-name exclusivity or trademark
clearance. Legal clearance has not been performed and no exclusivity is claimed.

Read the [security model](docs/SECURITY_MODEL.md), [threat model](THREAT_MODEL.md),
[autofix policy](AUTOFIX_POLICY.md), [validation record](docs/VALIDATION.md), and
[limitations](docs/LIMITATIONS.md) before relying on this alpha in a sensitive workflow.

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
prefixes, and exercises the Cydetix binary, default scan, setup, machine output, MCP, expert
commands, and packaged skill. Source-tree execution alone is not accepted as npm UX proof.

No publication action is performed by these commands. See the
[Cydetix zero-friction handoff](docs/CYDETIX_ZERO_FRICTION_HANDOFF.md) and
[publication gate](docs/PUBLICATION_GATE_FINAL.md).
