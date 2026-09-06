# Zero-friction UX and universal agent integration handoff

Date: 2026-09-06

Status: **source implementation complete; publication blocked**

This phase changes product identity and interaction surfaces without adding security rule families
or weakening the deterministic engine, remediation transaction model, sandbox controls, schemas, or
UNKNOWN semantics.

## 1. Simple UX architecture

The public experience is a thin orchestration layer over the existing engine:

```text
CLI / Agent Skill / MCP
          |
          v
deterministic scan + correlation
          |
          +--> concise human decisions
          +--> complete JSON / SARIF / expert output
          +--> policy-owned remediation transactions
```

The CLI, MCP server, and adapters live separately from the analysis/rule implementation. Adapters
only detect hosts and manage host configuration; they do not contain security-engine logic.

## 2. Default command

`vibeshield` scans the current working project. It needs no `scan .`, init, account, API key, cloud
service, global install, config, or Docker daemon. The engine determines which application,
authentication, authorization/tenant, secrets, dependencies, supply-chain, and CI/CD analyses are
applicable. Irrelevant or unsupported work is not represented as completed.

Default output is concise and decision-oriented. It reports checked areas and groups active results
as `FIX NOW`, `REVIEW`, or `UNKNOWN`. Canonical severity, confidence, proof/reachability state,
evidence, and stable rule IDs remain in the underlying report. `--details`, `--json`, and `--sarif`
expose expert data.

## 3. Fix command

`vibeshield fix` is explicit source-fix intent. It scans, builds plans, applies only deterministic
engine-classified `SAFE` transformations, verifies the invariant, rescans, and reports residual
issues. `vibeshield fix --dry-run` plans without writes. The legacy `--safe` flag is accepted as a
compatibility alias but cannot widen policy.

Dirty/stale/path/symlink/hash guards, transactional rollback, redaction, and verification provider
boundaries are unchanged. `REVIEW_REQUIRED` and `ARCHITECTURAL` plans stay unapplied.

## 4. Setup command

`vibeshield setup` detects supported agent environments without executing agent binaries. By default
it selects only detected agents, asks before changes in an interactive terminal, and makes no
non-interactive change without `--yes`. Operators may use repeatable `--agent`, `--all`,
`--dry-run`, `--uninstall`, and `--project` options.

Writes are bounded to documented adapter paths, merged into existing JSON/TOML where applicable,
refuse symlink/oversized/invalid configs, and use atomic replacement. Uninstall removes only the
`vibeshield` server entry and files carrying the VibeShield managed marker.

## 5. MCP architecture

`vibeshield mcp` is a local newline-delimited JSON-RPC stdio server backed directly by the same
engine and remediation transaction implementation as the CLI. It implements initialize, ping,
tools/list, and tools/call with exactly three public tools:

- `vibeshield_scan`: read-only full applicable assessment;
- `vibeshield_fix`: dry-run by default; policy-approved SAFE mutation only with explicit intent;
- `vibeshield_explain`: read-only rule or current-finding evidence.

No shell, arbitrary command, verification-command, rule-classification, sandbox, or raw low-level
engine interface is exposed through MCP.

## 6. Supported agents

Initial adapters cover OpenAI Codex/ChatGPT local surfaces, Claude Code, Cursor, GitHub Copilot,
Windsurf, and a generic MCP-compatible configuration. The defensible claim is:

> After one-time setup, supported AI coding agents can automatically invoke VibeShield when a
> security-related request is detected.

The host controls enablement, approval, and tool selection. VibeShield does not claim it
automatically runs in every agent.

## 7. Agent installation adapters

The adapters are under `src/integrations/<agent>/`. Their installed MCP launcher is pinned to the
version that performed setup: `npx --yes vibeshield@0.6.0-alpha.1 mcp` (through `cmd /c` on Windows
where required).

Three durable-launch strategies were evaluated:

| Strategy                         | Result                                                                  |
| -------------------------------- | ----------------------------------------------------------------------- |
| unpinned `npx vibeshield@latest` | Rejected: silently changes future code and weakens reproducibility      |
| hidden permanent global install  | Rejected: adds state, permissions, and lifecycle complexity             |
| version-pinned npx launcher      | Selected: brand-first, reproducible version, no required global install |

The selected approach may incur first-start download latency and requires npm/cache availability.
After the pinned package is cached it can work offline; a cold offline environment cannot install
it. An explicit update is `npx vibeshield@latest setup`, which lets the user review and repin
adapters. No complex self-updater was added.

## 8. Trigger model

The primary skill and host instructions include strong positive terms for security, secure, audit,
vulnerabilities, authentication, authorization, login, sessions, JWT, OAuth, secrets, dependencies,
supply chain, CI/CD, deployment readiness, production review, fixing, and hardening. They include an
explicit negative boundary for unrelated coding, styling, pagination, renaming, responsiveness, and
general debugging.

The scan/explain tools are eligible for relevant implicit read-only use. Fix selection is worded for
explicit remediate/repair/resolve intent only.

## 9. Trigger corpus results

`validation/agent-trigger-corpus.json` contains the requested 10 positive and 6 negative prompts.
`npm run validate:triggers` measured the deterministic descriptor-selection proxy:

| Metric              | Result |
| ------------------- | -----: |
| Correct             |     16 |
| Missed invocation   |      0 |
| Unwanted invocation |      0 |
| Total               |     16 |

This is a regression check for descriptions and intent routing, not a measurement of external host
models. No perfect automatic-invocation claim is made.

## 10. OpenAI implicit-skill behavior

The one canonical public skill is `agent-skills/vibeshield/SKILL.md`, with OpenAI metadata in
`agents/openai.yaml` setting `allow_implicit_invocation: true`. A security assessment request calls
the deterministic scan and summarizes only returned evidence. An explicit fix request calls
remediation, preserves classifications, verifies SAFE changes, and reports residuals. `UNKNOWN`
stays UNKNOWN unless separately resolved with evidence.

The implementation follows current OpenAI Agent Skills, MCP, and plugin conventions documented at
<https://learn.chatgpt.com/docs/build-skills>, <https://learn.chatgpt.com/docs/extend/mcp>, and
<https://learn.chatgpt.com/docs/build-plugins>.

## 11. Cursor behavior

The Cursor adapter writes/merges project `.cursor/mcp.json` under `mcpServers` and installs an
agent-requested `.cursor/rules/vibeshield.mdc`. It stores no secret. Cursor retains its own tool
approval behavior. Reference: <https://docs.cursor.com/context/model-context-protocol>.

## 12. Claude behavior

The Claude Code adapter writes/merges project `.mcp.json` and installs
`.claude/skills/vibeshield/SKILL.md`. Windows stdio uses `cmd /c npx`; other platforms invoke npx
directly. It does not assume deprecated global skill paths. References:
<https://code.claude.com/docs/en/mcp> and <https://code.claude.com/docs/en/slash-commands>.

## 13. Copilot behavior

The Copilot adapter installs `.github/skills/vibeshield`, scoped repository instructions at
`.github/instructions/vibeshield.instructions.md`, and VS Code `.vscode/mcp.json`. Repository and
host approval/security policies remain authoritative. Copilot CLI does not consume VS Code's
`.vscode/mcp.json`; that host requires its supported MCP configuration path or manual import, so
universal Copilot CLI automatic setup is not claimed. Reference:
<https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers>.

## 14. Windsurf behavior

The Windsurf adapter merges the user MCP configuration at `~/.codeium/windsurf/mcp_config.json` and
writes a project model-decision rule at `.windsurf/rules/vibeshield.md`. The host decides when tools
run. Reference: <https://docs.windsurf.com/windsurf/cascade/mcp>.

## 15. Generic MCP

The generic adapter writes a portable project `.vibeshield/mcp.json` snippet with a standard
`mcpServers.vibeshield` stdio entry. The user imports it into the host-specific supported location.
Tool invocation and approval remain controlled by that host.

## 16. Fix permission boundaries

| Operation           | Agent authority                                    |
| ------------------- | -------------------------------------------------- |
| Read-only scan      | May run implicitly for a relevant request          |
| Explanation         | May run implicitly                                 |
| Dry-run remediation | May run when the user asks about fixing/planning   |
| Source mutation     | Requires explicit fix/remediate intent             |
| REVIEW_REQUIRED     | Requires human review; never applied automatically |
| ARCHITECTURAL       | Never silently applied                             |

For MCP, `apply: true` is rejected unless `confirmedUserIntent` is exactly `fix-security-issues`.
That assertion does not bypass the deterministic SAFE classifier. MCP cannot authorize external
repository commands or relax path, secret, sandbox, execution, or rollback policy.

## 17. Migration from InvariantSec

Display name, npm metadata/lock metadata, primary CLI binary, human output, config default, plugin,
skill inventory, MCP identity, adapters, schemas, SBOM metadata, SARIF fingerprints, release
scripts, workflow artifact names, docs, and tests now use VibeShield. Stable `AS-*` rule IDs were
not changed.

For compatibility, package.json retains an `invariantsec` binary alias and the loader accepts legacy
`.invariantsec.json`. These aliases are absent from primary onboarding and can be deprecated on a
separate migration schedule.

## 18. Unscoped npm package availability

On 2026-09-06, `npm view vibeshield --json` queried `https://registry.npmjs.org/vibeshield` and
returned `E404 Not Found`. This indicates no exact registered package was visible at that moment. It
does not reserve the name or establish permission/ownership. The exact query must run again
immediately before an authorized first publish.

If the name exists, is protected, or cannot legitimately be used, publication must stop. No scoped
fallback is permitted without explicit approval of a different aligned product/package identity.

## 19. npm package identity

The candidate `package.json` has name `vibeshield` and maps `bin.vibeshield` to
`./dist/cli/main.js`. Display name and CLI server identity are VibeShield / `vibeshield`. Primary
README commands contain no GitHub/npm username, organization, or scope.

`0.6.0-alpha.1` is a candidate version only. Users may request a specific released version as
`npx vibeshield@0.6.0-alpha.1`; the ordinary quickstart remains unpinned after publication.

## 20. `npx vibeshield` verification

The actual `npm pack` tarball was installed into a clean temp consumer and invoked with an offline
local-tarball `npm exec --package=<tarball>` simulation. It passed version, zero-config current-
project scan, and setup flows. This is the closest valid pre-registry proof of `npx` package/bin
resolution. Source-tree execution was not accepted as evidence.

The literal live command `npx vibeshield` was not run against npm because the package is not
published. It must be tested after separately authorized registration.

## 21. `npm install -g vibeshield` verification

The same tarball was installed with `npm install --global --prefix <isolated>` and the actual
Windows `vibeshield.cmd` launcher passed `--version`, zero-config scan, and setup. A real global
registry install remains pending publication. Linux/macOS launcher behavior is represented in the
hosted matrix but was not executed locally in this phase.

## 22. Username/scope-free onboarding verification

Package name, binary, README quickstart, setup output, MCP IDs, skill ID, plugin ID, help, and
packed smoke tests use `vibeshield` with no scope. Repository audit found no maintainer username in
primary install/execution commands. The old binary/config names appear only in labeled compatibility
and migration documentation.

## 23. Verification results

Measured locally on Windows/amd64, Node 24.15.0, npm 11.12.1, Docker Desktop 4.52.0 / Engine 29.0.1:

- TypeScript check: pass.
- ESLint: pass.
- Prettier and generated-schema checks: pass after final formatting/regeneration.
- Full suite with immutable sandbox image enabled: 32 files, 152 tests passed, zero failed/skipped.
- Hardened sandbox suite independently: 13/13 passed.
- Trigger proxy: 16/16 correct, 0 missed, 0 unwanted.
- MCP validator: initialize plus exact three-tool surface passed.
- Canonical OpenAI skill validator: passed.
- Canonical OpenAI plugin validator: passed.
- Package allowlist: 312 entries, 289,188 packed bytes, 1,826,522 unpacked bytes.
- Packed install/npm-exec/global launcher/setup/MCP/advanced smoke: passed.
- npm audit: zero vulnerabilities at the measured run.
- Online OSV self-query: `CHECKED_NO_FINDINGS` for 214 resolved package identities; no source was
  transmitted.
- Workflow-security and public-tree privacy audits: passed.

Final command results are reproducible with `npm run verify`, `npm run validate:install`, and
`npm run test:sandbox` with the reviewed immutable image configured. Nothing was published, pushed,
tagged, committed, or submitted to a marketplace.

## 24. Limitations

- **Name conflict warning:** VibeShield already has active uses in the security market, including
  security-scanner and protection products at `vibeshield.org`, `vibe-shield.com`, `vibeshield.net`,
  `vibe-shield.net`, and `vibeshield.tech`, plus an extension and DDoS-protection use. No
  exclusivity, trademark clearance, freedom to operate, or lack of confusion is claimed.
- npm `E404` is point-in-time evidence only. Ownership, Trusted Publishing, provenance, and live
  package behavior are unestablished.
- External host/model invocation accuracy, remote marketplace installation, Copilot CLI MCP setup,
  hosted Windows/Linux/macOS jobs, CodeQL, Scorecard, attestations, and real registry consumers are
  not locally proven.
- Pinned npx MCP startup trades supply-chain/version stability for cold-start/cache dependence.
- Static analysis and SAFE-fix coverage remain deliberately bounded; VibeShield is not a security or
  compliance certification. Review `docs/LIMITATIONS.md` for engine-specific limits.

Publication state remains **NOT_READY_FOR_PUBLICATION**. Recheck the exact npm name and obtain an
explicit identity decision after reviewing active market uses. If the unscoped name cannot
legitimately be used, stop and wait for approval of a different aligned brand/package identity.
