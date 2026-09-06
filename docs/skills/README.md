# Cydetix Agent Skill and Codex plugin

Cydetix presents one user-facing security capability: `cydetix`. Its description covers security
review, authentication, authorization, sessions, JWT, OAuth, secrets, dependencies, supply chain,
CI/CD, deployment readiness, hardening, and explicit security remediation. It also states a negative
boundary for unrelated coding and UI work.

The canonical skill lives at `agent-skills/cydetix`. The Codex plugin contains an exact copy at
`plugins/cydetix/skills/cydetix` plus a version-pinned local stdio MCP declaration. Current OpenAI
metadata enables implicit invocation; the host still makes a probabilistic selection and no perfect
automatic-invocation claim is made.

## Behavior boundary

- `cydetix_scan` and `cydetix_explain` are read-only and may run implicitly for a relevant security
  request.
- `cydetix_fix` may produce a dry-run plan when the user asks about fixing.
- Source mutation requires explicit fix/remediate intent and the MCP confirmation value
  `fix-security-issues`.
- The deterministic engine, not the agent, owns `SAFE`, `REVIEW_REQUIRED`, and `ARCHITECTURAL`
  classification.
- Agents may summarize returned evidence but may not invent findings or upgrade `UNKNOWN`.

## Setup and validation

The primary onboarding is the normal scan:

```bash
npx cydetix
```

After scanning, an interactive run detects supported hosts and can install managed skill material
plus a pinned `cydetix@<setup-version> mcp` stdio server after one permission question. It never
writes secrets and never prompts in automation. Explicit management uses `cydetix setup`,
`--status`, `--verify`, or `--remove`.

Where MCP is unavailable but shell execution is permitted, installed instructions use the pinned CLI
with `--json`; no adapter contains scanner logic.

Repository validation:

```bash
npm run validate:skills
npm run validate:plugin
npm run validate:mcp
npm run validate:triggers
```

The trigger corpus is a deterministic description-selection proxy. Results do not establish how
every external host/model will behave. Review installed skill instructions because agent skills can
influence agent behavior.

Official references used for this adapter are the current OpenAI Agent Skills, MCP, and plugin
documentation. Remote plugin distribution and marketplace acceptance remain unverified until an
approved public repository and release exist.
