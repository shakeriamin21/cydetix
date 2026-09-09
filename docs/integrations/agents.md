# Local coding-agent compatibility

Cydetix `0.6.0-alpha.7` is a local, agent-independent security runtime. Every supported host uses
the same three stdio MCP tools and the same deterministic engine. Host adapters only detect and
merge configuration; they contain no vulnerability rules, proof logic, authentication or
authorization analysis, or remediation classification.

The capability registry describes the integration Cydetix provides in this release. `mcpHttp` is
false for every entry because remote HTTP MCP is intentionally out of scope, even where a host may
support other remote MCP servers.

| ID            | Aliases          | Verified configuration target                                  | Skill |
| ------------- | ---------------- | -------------------------------------------------------------- | ----- |
| `codex`       | `chatgpt`        | `~/.codex/config.toml`                                         | Yes   |
| `claude`      | `claude-code`    | `<project>/.mcp.json`                                          | Yes   |
| `cursor`      |                  | `<project>/.cursor/mcp.json`                                   | Rules |
| `copilot`     | `github-copilot` | `<project>/.vscode/mcp.json`                                   | Yes   |
| `windsurf`    |                  | `<project>/.devin/mcp_config.local.json`                       | Yes   |
| `gemini`      | `gemini-cli`     | `<project>/.gemini/settings.json`                              | Yes   |
| `cline`       |                  | `~/.cline/data/settings/cline_mcp_settings.json`               | No    |
| `roo`         | `roo-code`       | `<project>/.roo/mcp.json`                                      | No    |
| `continue`    | `continue-dev`   | `<project>/.continue/mcpServers/cydetix.json`                  | No    |
| `goose`       |                  | platform user config `config.yaml`, under `extensions.cydetix` | No    |
| `generic-mcp` | `generic`        | `<project>/.cydetix/mcp.json`                                  | No    |

The Gemini, Cline, Roo Code, Continue, and Goose layouts were selected from their current official
documentation or source. Cline intentionally uses the resolver implemented by current source rather
than the disputed `~/.cline/mcp.json` documentation path. Continue uses its documented isolated
workspace MCP-block directory so Cydetix never needs to rewrite the user's main model configuration.

## Setup selection

`cydetix setup` and `cydetix setup --agent auto` passively inspect known paths and PATH entries.
PATH checks test file presence and executable permissions; host binaries are never executed. Generic
MCP is excluded from automatic selection.

`cydetix setup --agent all --yes` selects detected user-scoped hosts plus hosts with a documented
project-scoped configuration. It does not select Generic MCP and does not create user-scoped host
trees for undetected software. Explicit IDs may be repeated.

Setup remains confirmation-gated unless `--yes` explicitly records user intent. CI, MCP, agent
subprocess, and non-TTY environments never prompt. The implicit post-scan setup path never runs in
those environments.

## Compatibility tiers

- Tier 1 - Native MCP: the host consumes all three structured local stdio tools.
- Tier 2 - Deterministic CLI: an agent invokes the setup-verified absolute Node executable and
  absolute Cydetix entrypoint with `CYDETIX_AGENT_SUBPROCESS=1` and strict JSON output.
- Tier 3 - CI/report consumption: the environment consumes SARIF, JSON, or CI results. This is not
  described as full interactive integration.

Inspect the registry with `cydetix doctor --agents` or its stable schema-backed JSON form:

```powershell
cydetix doctor --agents --format json
```

## Generic MCP

Create the project-scoped escape hatch explicitly:

```powershell
cydetix setup --agent generic-mcp --yes --project "<project>"
```

Print the same validated definition without changing files:

```powershell
cydetix mcp-config --format json --project "<project>"
```

Both forms contain the exact absolute Node executable, exact absolute Cydetix JavaScript entrypoint,
canonical project root, and exact required version. They contain no npm, npx, package-manager,
downloader, shell, or network bootstrap.

## Bounded MCP roots and transport

Alpha.7 does not consume host-provided `roots/list` results. The configured canonical project root
remains authoritative and MCP requests may select only real directories inside it. Client capability
or root declarations cannot widen access. Local stdio remains the only Cydetix MCP transport;
remote/cloud HTTP MCP is deferred until its separate authentication, authorization, tenancy,
privacy, sandboxing, audit, and retention requirements are designed.
