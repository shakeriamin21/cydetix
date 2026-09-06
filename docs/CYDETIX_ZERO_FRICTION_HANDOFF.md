# Cydetix zero-friction UX handoff

Checked: 2026-09-06  
Version: `0.6.0-alpha.1`  
Final verdict: **NOT_READY**

This verdict means not ready to bootstrap or publish the public repository. The Cydetix rename,
zero-config CLI, deterministic MCP layer, host adapters, and local package proof are implemented,
but public Git author metadata is not approved and the external GitHub/npm/legal gates remain open.
Nothing was published, pushed, tagged, or released.

## 1. Final identity

- Display name: **Cydetix**
- Tagline: **Security for AI-built software.**
- npm package: `cydetix`
- CLI: `cydetix`
- Intended GitHub repository name: `cydetix`
- Primary Agent Skill and plugin ID: `cydetix`
- MCP server display name: **Cydetix**
- Public MCP tools: `cydetix_scan`, `cydetix_fix`, `cydetix_explain`

Package and binary identity are exact and unscoped. Normal onboarding contains no owner, username,
organization, or package scope.

## 2. Rename summary

All current public product, package, CLI, config, setup, skill, plugin, MCP, schema metadata, SBOM,
release, workflow, test, fixture, and documentation identity was migrated to Cydetix. Earlier
unpublished candidate aliases and configuration filenames were removed rather than exposed as public
compatibility surfaces. Stable `AS-*` security rule IDs were deliberately preserved.

The current-tree audit checks both content and filenames for earlier candidate brands. It returned
no current public identity residue. Historical Git metadata is governed separately and currently
fails its explicit author-approval gate; see section 28.

## 3. CLI behavior

The primary interface is:

```bash
npx cydetix
```

or, after a global install:

```bash
cydetix
```

With no subcommand, the CLI scans the current working directory using applicable deterministic
application, authentication, authorization/tenant, session/token/OAuth, secret, dependency,
supply-chain, and CI/CD analysis. Irrelevant engines are not claimed as complete. Internal
`PROVEN_SECURE`, `PROVEN_INSECURE`, `UNKNOWN`, and `NOT_APPLICABLE` semantics are preserved.

Human output is a concise Cydetix result with analyzed areas, security status, `FIX NOW`, `REVIEW`,
and `UNKNOWN` counts, a short prioritized finding list, SAFE-remediation availability, and the next
command. Full evidence remains available through `--details`, `--json`, and `--sarif`.

## 4. `npx cydetix` behavior

The packed-artifact npm-exec simulation proves that the unscoped Cydetix launcher starts without an
init step, uses the current directory, emits concise human output, and does not prompt when stdin or
stdout is non-interactive. In a real interactive terminal, the command completes and prints the scan
first, then inspects compatible hosts and asks at most one consent question before changing external
agent configuration.

No account, API key, cloud backend, global install, mandatory config, npm/GitHub username, Docker
daemon, lifecycle script, or repository-code execution is required for an ordinary scan.

## 5. AI automatic discovery architecture

`src/integrations/discovery` is the single discovery engine. Each adapter reports installation and
integration separately; finding an executable or directory is not treated as successful setup.
Integration states are:

- `configured`
- `not_configured`
- `partially_configured`
- `unsupported_version`
- `configuration_inaccessible`

Discovery is passive: it checks bounded paths and executable presence without launching the host.
The default CLI calls it only after scan output. Configured hosts are not prompted again.

## 6. Automatic registration architecture

Interactive first-run registration is scan-first and consent-bound:

1. scan the current project;
2. inspect compatible hosts and current Cydetix entries;
3. list only detected hosts that need configuration;
4. ask one permission question;
5. apply host adapters;
6. re-inspect and report verified status;
7. store minimal local disposition state.

CI, MCP, agent subprocesses, pipes, and other non-interactive sessions never prompt or
auto-configure. Explicit non-interactive setup requires `--yes`. The package has no install,
preinstall, postinstall, or prepare lifecycle hook.

## 7. Supported AI hosts

| Host/surface                    | Tier               | Installed integration                                                  | Current limitation                                                        |
| ------------------------------- | ------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| OpenAI Codex                    | A                  | `~/.codex/config.toml` plus `~/.codex/skills/cydetix`                  | Host controls final implicit selection and approvals                      |
| ChatGPT/Codex plugin surfaces   | A where applicable | Packaged Cydetix plugin with one skill and one MCP server              | No universal standalone ChatGPT local-registration claim                  |
| Claude Code                     | A                  | project `.mcp.json` plus `.claude/skills/cydetix`                      | Host policy and version control invocation                                |
| Cursor                          | A/B                | `.cursor/mcp.json` plus relevance-selected `.cursor/rules/cydetix.mdc` | Host controls tool availability and approval                              |
| GitHub Copilot                  | A/B                | `.vscode/mcp.json` plus `.github/skills/cydetix`                       | Surface support varies; repository approval rules remain authoritative    |
| Windsurf/current Devin surfaces | A/B                | `.devin/mcp_config.local.json` plus `.windsurf/skills/cydetix`         | Product/version transition means live-host verification remains necessary |
| Other MCP clients               | B                  | explicit generated `.cydetix/mcp.json`                                 | Host must import/consume the generated config                             |
| Shell-capable agents            | C                  | pinned CLI instructions and JSON output                                | Shell permission and host behavior control execution                      |
| No extension mechanism          | D                  | direct CLI                                                             | No automatic invocation is possible                                       |

The defensible claim is: after one-time setup, supported AI coding agents can automatically invoke
Cydetix when a security-related request is detected. Cydetix does not claim every AI can do so.

## 8. Generic MCP

Explicit generic setup is:

```bash
cydetix setup --agent generic-mcp --yes
```

It writes a portable stdio entry to `.cydetix/mcp.json`. The launcher is version-pinned to the setup
version, for example `cydetix@0.6.0-alpha.1`, instead of silently following arbitrary future
versions. On Windows it uses `cmd /c npx`; on POSIX systems it uses `npx` directly. The config
stores no secret. Startup needs the pinned package installed or available in npm's cache/registry.

## 9. CLI fallback

An agent with shell execution but no MCP consumes the same deterministic engine through:

```bash
cydetix --json
```

Installed instructions pin npm execution for reproducibility. They use JSON assessment, zero-write
`fix --dry-run --format json` for planning, and only use `fix --non-interactive --format json` after
explicit fix intent. No adapter contains scanner logic.

## 10. No-explicit-tool-name behavior

The Skill description, MCP descriptions, Cursor rule, and fallback instructions describe semantic
security intent: project security, vulnerabilities, authentication, authorization, login, sessions,
JWT, OAuth, secrets, dependencies, supply chain, CI/CD, deployment safety, production readiness, and
hardening. They explicitly exclude unrelated UI, styling, pagination, renaming, refactoring, and
general debugging.

Consequently, prompts such as `Check this project for security issues` or `Is my OAuth safe?` can
select Cydetix without naming the product or an MCP tool. Selection remains probabilistic and
host-controlled.

## 11. Natural-language trigger results

The deterministic descriptor-selection proxy expanded from 16 baseline cases to 36 cases:

- 22 read-only security prompts selected `cydetix_scan`;
- 2 explicit remediation prompts selected `cydetix_fix`;
- 12 unrelated prompts selected no Cydetix tool;
- 36/36 correct, 0 missed, 0 unwanted in this proxy.

No corpus prompt mentions Cydetix. These results validate descriptions and boundaries, not every
proprietary host/model combination, so perfect automatic invocation is not claimed.

## 12. Integration configuration safety

Adapters parse existing config, preserve unrelated entries, refuse invalid or unsafe files, reject
symlinked/non-regular paths, bound file size, and never inspect or store credentials. Writes use a
same-directory temporary file and atomic replacement, with a restrictive transient backup where an
existing file is changed. The result is parsed/re-inspected after write. Failed validation triggers
rollback, and inability to prove rollback fails closed.

Managed skills/rules have an ownership marker. Removal changes only the `cydetix` MCP entry and
Cydetix-managed files. Repeated setup does not duplicate registrations. Running `setup` again
updates a pinned-version drift; `setup --status` inspects, `setup --verify` verifies, and
`setup --remove` removes managed integration.

Local `.cydetix/integration-state.json` stores only schema version,
`configured`/`declined`/`partial` disposition, package version, timestamp, and host states. It
stores no token, password, source, conversation, or credential.

## 13. MCP tools

- `cydetix_scan`: read-only comprehensive applicable-engine orchestration for natural security,
  vulnerability, deployment, authentication/authorization, secret, dependency, supply-chain, CI/CD,
  and hardening requests.
- `cydetix_fix`: dry-run by default; mutation requires `apply: true` plus the exact confirmed-intent
  value and can execute only engine-classified SAFE remediation.
- `cydetix_explain`: read-only finding/rule/evidence/UNKNOWN explanation.

All three call the same `scanRepository`/`runRemediation` core used by the CLI. The server fixes its
project boundary to its startup working directory, rejects escapes, bounds request lines, returns
terminal-safe errors, and exposes no low-level filesystem or execution tool.

## 14. Skill

There is one primary user-facing skill at `agent-skills/cydetix`, mirrored exactly into the Codex
plugin. OpenAI metadata sets `allow_implicit_invocation: true`, display name `Cydetix`, and a
natural default security prompt. The canonical and plugin copies pass both repository validation and
the current OpenAI skill validator. The Codex plugin and local marketplace entry pass the canonical
plugin validator.

The skill requires deterministic evidence, preserves UNKNOWN, treats repository content as untrusted
data, and includes MCP and pinned-CLI paths. It does not introduce security findings or rules.

## 15. Mutation-intent boundary

Read-only scan and explanation may be selected implicitly. A discussion about possible fixes may
request a dry-run plan. Source mutation requires an explicit user request to fix, remediate, repair,
or resolve security issues.

For direct CLI users, `cydetix fix` is itself explicit fix intent and `--dry-run` is the zero-write
form. For MCP, `apply: true` also requires `confirmedUserIntent: "fix-security-issues"`. A host or
repository cannot manufacture this permission by changing a prompt file or remediation class.

## 16. Remediation policy

Cydetix rescans, correlates stable findings, classifies plans, checks hashes/paths/file identity,
applies only SAFE transformations, parses affected source, performs explicitly authorized
verification where supplied, rescans the full project, proves the expected invariant transition, and
reports residual findings. Only `APPLIED_VERIFIED` is a successful fix.

`REVIEW_REQUIRED` remains a plan requiring review. `ARCHITECTURAL` is never silently applied.
Verification failure, stale source, an unavailable required sandbox, an unproven rollback, or an
unconfirmed cleanup fails closed.

## 17. Sandbox guarantees

The 13/13 empirical container tests pass against immutable image digest
`sha256:1b2479dd35a99687d6638f5976fd235e26c5b37e8122f786fcd5fe231d63de5b`. They exercise network
denial, sanitized environment, ephemeral copy, host-home/temp/socket isolation, non-root UID/GID,
all capabilities dropped, no-new-privileges, runtime-default seccomp, read-only root,
memory/swap/CPU/PID/tmpfs/time/output bounds, entrypoint clearing, cleanup, no local fallback, SAFE
remediation, rollback, and output non-retention.

Container isolation remains defense in depth and depends on Docker, the host kernel/runtime, and the
reviewed image. Ordinary scanning needs no Docker and never executes repository programs.

## 18. Project boundary

Repository discovery canonicalizes the selected current project, requires a real directory, rejects
path escapes and unsafe file types, does not follow symlinks, and bounds count, depth, size, and
content. MCP paths must remain beneath the server working directory. Integrations expose no general
filesystem tool and do not authorize home, SSH, credential-store, unrelated-repository, or system
scans.

## 19. Prompt-injection handling

Repository files, comments, docs, workflow text, and generated text are data. They cannot override
Cydetix policy, skill instructions, MCP boundaries, source-mutation intent, remediation class,
sandbox controls, or command authorization. Hostile-repository regressions include instruction-like
source and prove it is not executed or followed.

## 20. Windows/PowerShell behavior

The actual packed tarball was installed with lifecycle scripts disabled into isolated local and
global prefixes on Windows/Node 24. The generated `.cmd` launcher passed version, help, current-
directory default scan, setup, setup status, SAFE fix, JSON, SBOM, and MCP checks. Windows MCP
entries use `cmd /c npx --yes cydetix@<exact-version> mcp`. Adapter tests cover Windows launcher
shape and filesystem transaction behavior without assuming Bash or a drive letter in product code.

## 21. Linux behavior

POSIX MCP entries use direct `npx --yes cydetix@<exact-version> mcp`. Code and workflow tests cover
POSIX path/launcher generation, and the full sandbox workload executes in Linux/amd64 containers.
The GitHub-hosted Linux Node matrix and clean external consumer remain `NOT_RUN` until a public
repository exists.

## 22. macOS behavior

The adapter and launcher model is path-module based and uses the direct POSIX `npx` form. The
GitHub-hosted macOS Node 22/24 matrix is configured but `NOT_RUN`; no local macOS binary or global
install claim is made by the Windows run.

## 23. Package validation

The current package gate validates the exact unscoped `cydetix` package, exactly one binary mapping
to `./dist/cli/main.js`, the username/scope-free README, absence of lifecycle scripts, allowed
contents, and size limits. The latest measured artifact contains 320 entries and remains below the
400 KB packed / 2.5 MB unpacked gates.

Clean packed-artifact tests pass for:

- version and help;
- default current-project scan;
- setup and setup status;
- real globally installed `cydetix` launcher;
- local-tarball npm-exec equivalent;
- SAFE verified fix and dry-run;
- JSON, advanced scan/auth/supply-chain/SBOM paths;
- one packaged skill;
- MCP initialization and exact three-tool surface.

Preview package, CycloneDX SBOM, plugin archive, validation summary, release-input manifest, public
release manifest, and SHA-256 checksums exist under `.cydetix/release-preview`. They are explicitly
`UNCOMMITTED_PREVIEW` and `NOT_READY_FOR_PUBLICATION`.

## 24. Privacy validation

- Current public tree: PASS, 674 files, no issues.
- Independent Gitleaks 8.30.1 current-tree export: PASS after nine fully redacted reviewed
  synthetic/schema findings.
- Independent Gitleaks 8.30.1 one-commit history: PASS after the same expected finding classes.
- Deterministic Git-history author/privacy allowlist: FAIL because the existing commit author email
  has not been explicitly approved for public use.

No personal path, private email, username, temporary artifact, real secret, or earlier candidate
identity was found in current public/package content. The unapproved commit metadata must be
resolved before any push; it is not reproduced here.

## 25. Supply-chain results

- `npm audit`: 0 vulnerabilities on 2026-09-06.
- Online OSV: `CHECKED_NO_FINDINGS` for 214 normalized resolved npm identities; source was not
  transmitted.
- CycloneDX 1.7: generated and validated from lockfile evidence.
- GitHub Actions security: PASS for no `pull_request_target`, full-SHA action pins, no long-lived
  npm token, tag-only release trigger, protected release environment, and publish-job-only OIDC.
- License inventory: PASS for 162 dependencies; no bundled dependencies.
- Self-scan: PASS, 0 active and 28 intentionally suppressed dated fixture findings.
- Package contents, packed install, plugin archive, schemas, SARIF, remediation, and checksums:
  PASS.

These are dated provider/build observations, not a claim that advisory sources are exhaustive or
that dependency presence proves vulnerable function reachability.

## 26. Tests

Baseline before changes:

- Git: clean `main`, HEAD `068f87c71a033f18dc69862261ec4f8478909f48`.
- Canonical serialized suite: 32 files, 152 tests, 0 failures, 0 skips.
- Sandbox: 13/13.
- Trigger proxy: 16/16 correct, 0 unwanted.
- Package: 312 entries, 289,188 packed bytes, 1,826,522 unpacked bytes.
- npm audit: 0 vulnerabilities.
- OSV: no findings across 214 resolved identities.
- Self-scan: 0 active, 28 suppressed.
- Packed install and MCP three-tool checks: PASS.

Both baseline and final cold aggregate attempts observed a transient `AVAILABLE_DEGRADED` Docker
capability probe and failed closed rather than counting skipped sandbox tests. A direct doctor
probe, isolated 13/13 sandbox run, and complete serialized rerun returned `AVAILABLE_HARDENED`
without any control relaxation.

Final:

- 32 test files, 197 tests, 0 failures, 0 skips.
- 45 assertions added for zero-friction UX and agent integration.
- Trigger proxy: 36/36 correct, 0 missed, 0 unwanted.
- Formatting, lint, TypeScript, 16 generated schemas, 20 stable rules, MCP, skill, plugin, SARIF,
  CycloneDX, remediation, workflow, license, public-tree, package, and packed-install gates pass.
- Machine-readable verdict: `NOT_READY_FOR_PUBLIC_USE` because source/history publication gates are
  intentionally not bypassed.

## 27. Limitations

- Automatic tool/skill selection is controlled by each host and model; the local trigger proxy is
  not a universal host benchmark.
- Host paths and formats were checked against current official documentation, but external product
  changes can invalidate adapters. Reverify before release.
- Only Windows packed/global execution was observed locally. Hosted Windows/Linux/macOS validation
  has not executed.
- The package is not registered, so installed pinned MCP commands cannot resolve from the public npm
  registry yet.
- Remote plugin installation, marketplace acceptance, standalone ChatGPT registration, live Claude,
  Cursor, Copilot, and Windsurf invocation, and host approval behavior remain externally unverified.
- Static-analysis/framework coverage and automatic SAFE-fix coverage remain deliberately bounded.
- Local explicitly authorized commands are not a sandbox. Container verification is optional and
  capability-dependent.
- Cydetix does not certify complete security, compliance, production readiness, or absence of
  vulnerabilities.

Current documentation references used for adapter decisions:
[OpenAI Agent Skills](https://learn.chatgpt.com/docs/build-skills),
[OpenAI MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli),
[Claude Code MCP](https://code.claude.com/docs/en/mcp),
[Claude Code plugins](https://code.claude.com/docs/en/plugins),
[Cursor MCP](https://prod.cursor.com/help/customization/mcp),
[Cursor rules](https://prod.cursor.com/docs/rules),
[GitHub Copilot Agent Skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills),
[GitHub Copilot MCP](https://docs.github.com/en/copilot/concepts/context/mcp),
[Windsurf/current Devin skills](https://docs.devin.ai/desktop/cascade/skills), and
[current Devin MCP](https://docs.devin.ai/cli/extensibility/mcp/configuration).

## 28. Exact remaining release blockers

1. The existing Git commit contains an author email not explicitly approved for public history.
   Supply approved public author metadata and perform a separately reviewed history correction
   before any push.
2. Current changes and preview artifacts are uncommitted. Create a clean reviewed commit only after
   blocker 1 is resolved, then regenerate artifacts/checksums from that commit.
3. The intended `cydetix` GitHub repository/owner is not configured. Hosted OS matrix, CodeQL,
   Scorecard, external Action-consumer, repository security settings, protected `release`
   environment, private vulnerability reporting, and attestations have not executed.
4. Formal name/trademark/legal review is not complete. Limited exact-name web searches are not
   clearance and no exclusivity is claimed.
5. The unscoped npm coordinate returned E404 but is not owned or reserved. Initial registration is
   not authorized and npm Trusted Publishing cannot be configured until the package exists.
6. Real-registry `npx cydetix` and global-install checks, remote plugin/marketplace checks, and live
   supported-host invocation tests remain unexecuted.
7. This phase expressly withholds publication authorization.

## 29. npm availability

Exact command, run again on 2026-09-06:

```bash
npm view cydetix --json
```

Exact result class: npm `E404 Not Found` for `https://registry.npmjs.org/cydetix`; the response also
notes that the resource may be absent or inaccessible to the caller. This is only point-in-time
availability evidence. It does not establish ownership, legitimate registrability, reservation,
trademark clearance, or permission to publish.

If the exact coordinate is occupied, protected, unavailable, or conflicting at the next check, stop.
Do not use a scoped fallback or expose an owner in the normal command. A different identity requires
explicit user approval.

## 30. Next publication actions

1. Obtain approved public Git author metadata and review any history correction before executing it.
2. Review the full diff, create a clean commit, and rerun all local gates and `release:artifacts`.
3. Complete formal name/legal review and recheck `npm view cydetix --json` immediately before any
   separately authorized registration.
4. Create/configure the intended public GitHub repository and security controls; run all hosted
   Windows/Linux/macOS, CodeQL, Scorecard, sandbox, and consumer tests.
5. If and only if separately authorized, bootstrap the exact reviewed unscoped alpha with the
   `alpha` dist-tag, configure npm Trusted Publishing, and verify live npm-exec/global flows.
6. Only after every gate passes, seek separate authorization for tags, push, npm publication,
   attestations, plugin distribution, and a GitHub release.

Until then, the final release/bootstrap verdict remains **NOT_READY**.
