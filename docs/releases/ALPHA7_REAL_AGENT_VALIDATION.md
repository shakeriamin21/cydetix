# Alpha.7 real installed-agent validation

Date: 2026-09-10  
Gate candidate: `0.6.0-alpha.7` at `e89635e0537bde3b30490ac3b6c876b8f149956a`

## Final gate

`PUBLIC_ALPHA_VALIDATED`

No tag, npm publication, dist-tag change, or GitHub release was performed during this validation.

## Candidate identity

The candidate was frozen before testing. `git status` was clean, `git rev-parse HEAD` returned the
expected SHA, and both the built CLI and package manifest returned `0.6.0-alpha.7`.

| Evidence               | Value                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| Candidate commit       | `e89635e0537bde3b30490ac3b6c876b8f149956a`                              |
| Cydetix version        | `0.6.0-alpha.7`                                                         |
| Tarball                | `cydetix-0.6.0-alpha.7.tgz`                                             |
| Tarball SHA-256        | `846B211C439E33F2F03D98DD9436FBA014731B6A297207412DD5A7239D09E1FC`      |
| Packed files           | 353; exact list in [ALPHA7_PACKED_FILES.txt](./ALPHA7_PACKED_FILES.txt) |
| Packed package version | `0.6.0-alpha.7`                                                         |
| Node.js                | `v24.15.0`                                                              |
| npm                    | `11.19.1`                                                               |
| OS                     | Microsoft Windows 10 Enterprise 64-bit, `10.0.19045`, build `19045`     |

`npm run build` and `npm pack` completed successfully. The packed artifact was extracted for the
tests, and its exact `dist/cli/main.js` was invoked with the exact Node executable. Existing local
dependencies were exposed through a directory junction; no dependency download or install occurred.

## Hosted gate status

The mission supplied the following already-passed hosted status for this exact candidate. These
checks were recorded here and were not independently re-executed by this Windows real-agent gate:

- Windows Node 22: passed
- Windows Node 24: passed
- Ubuntu Node 22: passed
- Ubuntu Node 24: passed
- macOS Node 22: passed
- macOS Node 24: passed
- Linux container sandbox: passed
- GitHub Action smoke: passed
- CodeQL: passed
- OpenSSF Scorecard: passed

## Isolated projects

Public-repository path notation below uses `%TEMP%`, `%APPDATA%`, and `%USERPROFILE%` in place of
their run-specific expansions. The validation commands resolved and compared the canonical absolute
paths after expansion.

All targets were outside the Cydetix repository and were initialized as independent Git
repositories:

| Purpose                       | Canonical path                                                  |
| ----------------------------- | --------------------------------------------------------------- |
| Secure TypeScript project     | `%TEMP%\cydetix-alpha7-real-agent-e89635e\projects\secure`      |
| Vulnerable TypeScript project | `%TEMP%\cydetix-alpha7-real-agent-e89635e\projects\vulnerable`  |
| Hostile repository            | `%TEMP%\cydetix-alpha7-real-agent-e89635e\projects\hostile`     |
| SAFE-remediation project      | `%TEMP%\cydetix-alpha7-real-agent-e89635e\projects\remediation` |
| Sibling escape target         | `%TEMP%\cydetix-alpha7-real-agent-e89635e\projects\sibling`     |
| Boundary/junction target      | `%TEMP%\cydetix-alpha7-real-agent-e89635e\projects\boundary`    |

The secure project returned zero findings. The vulnerable project returned six deterministic
findings: one critical and five high, including one SAFE `AS-SESSION-001` HttpOnly change. Direct
scan reports identified `0.6.0-alpha.7`, the exact canonical root, offline mode, and
`mutatedRepository: false`.

## Real host matrix

Executable and application discovery occurred before generated configuration was added. A post-setup
`doctor --agents` report is not used as proof that a host binary exists because a generated project
configuration is itself detection evidence.

| Host         | Availability evidence                                            | Real-host status                   | Configuration status | Verdict evidence                                                                                                                                         |
| ------------ | ---------------------------------------------------------------- | ---------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI Codex | `codex-cli 0.153.4`; executable on PATH                          | `PASS_REAL_HOST`                   | `PASS_CONFIG_ONLY`   | Fresh installed host called all three Cydetix tools against the canonical vulnerable project; hostile-repository run also passed.                        |
| Gemini CLI   | No executable on PATH                                            | `NOT_AVAILABLE_FOR_REAL_HOST_TEST` | `PASS_CONFIG_ONLY`   | Project-scoped setup, verify, JSON parse, preservation, exact argv, and Tier 1 registry checks passed.                                                   |
| Claude Code  | `2.1.197`; executable present, but host reported `Not logged in` | `NOT_AVAILABLE_FOR_REAL_HOST_TEST` | `PASS_CONFIG_ONLY`   | Claude loaded the generated MCP file with `skills: []` and Cydetix pending, but authentication failed before a model/tool turn. No real scan is claimed. |
| Cursor       | No CLI, known application path, extension, or process found      | `NOT_AVAILABLE_FOR_REAL_HOST_TEST` | `PASS_CONFIG_ONLY`   | Project-scoped setup, verify, JSON parse, preservation, exact argv, and rule generation passed.                                                          |
| Cline        | No CLI or installed VS Code/Cursor extension found               | `NOT_AVAILABLE_FOR_REAL_HOST_TEST` | `PASS_CONFIG_ONLY`   | Isolated user-scoped setup, verify, JSON parse, preservation, and exact argv passed.                                                                     |
| Roo Code     | No CLI or installed VS Code/Cursor extension found               | `NOT_AVAILABLE_FOR_REAL_HOST_TEST` | `PASS_CONFIG_ONLY`   | Project-scoped setup, verify, JSON parse, preservation, and exact argv passed.                                                                           |
| Generic MCP  | Not a host application                                           | Not applicable                     | `PASS_CONFIG_ONLY`   | Generated definition, direct launch, tool enumeration, scan, explain, fix, boundary, and version-pin tests passed.                                       |

VS Code was present, but neither Cline nor Roo Code was installed in the inspected VS Code, Cursor,
or VS Code Insiders extension roots. No host software was installed or downloaded.

## Codex real-host evidence

The real user-scoped Codex integration began with an existing managed alpha.6 Cydetix entry. The
pre-test Codex config and skill were backed up. Setup from the packed alpha.7 artifact updated only
the managed Cydetix block, preserved all unrelated `config.toml` bytes, and passed both
`setup --verify --agent codex` and human/JSON `doctor --agents` checks.

The generated managed block used:

```text
command: C:\Program Files\nodejs\node.exe
entrypoint: %TEMP%\cydetix-alpha7-real-agent-e89635e\runtime\package\dist\cli\main.js
argv: mcp --project-root %TEMP%\cydetix-alpha7-real-agent-e89635e\projects\vulnerable --require-version 0.6.0-alpha.7
```

A fresh `codex exec` process received the natural prompt `Check this project for security issues.`
without a tool name. Its JSONL event stream contained an MCP call to server `cydetix`, tool
`cydetix_scan`, with `path: "."`. The structured result reported:

- tool version `0.6.0-alpha.7`;
- canonical manifest root equal to the vulnerable project;
- offline execution;
- `mutatedRepository: false`;
- the same one-critical/five-high findings as the direct packed-runtime baseline.

In the resumable follow-up conversation, `Explain the security issue Cydetix found.` caused Codex to
call `cydetix_explain` for all six finding fingerprints. `Can Cydetix safely fix this?` caused a
`cydetix_fix` call with `apply: false` for the critical JWT finding. Noninteractive Codex initially
denied that mutation-capable tool under its default never-approve policy, but it did not bypass
Cydetix: it preserved the `ARCHITECTURAL` classification and made no change.

A bounded `--approve-for-me` retry remained project-scoped and explicitly prohibited writes. Codex
called `cydetix_scan`, `cydetix_fix` with `apply: false`, `cydetix_explain`, and a finding-scoped
`cydetix_fix` dry run. Cydetix classified the HttpOnly replacement as `SAFE`, retained the adjacent
`secure: false` finding as `REVIEW_REQUIRED`, and reported zero changed paths. Codex repeated those
classifications without reinterpretation.

The real Codex config and installed skill were restored after testing. SHA-256 comparison proved all
three restored files were byte-for-byte identical to their pre-test backups.

## Claude Code evidence

The generated project `.mcp.json` was loaded with `--strict-mcp-config` and
`--disable-slash-commands`. Claude's initialization event reported `skills: []`, proving the test
did not rely on the generated skill for discovery. The Cydetix MCP server appeared in the loaded
server list, but the host then returned `Not logged in · Please run /login` before any model or tool
turn. This is configuration evidence only, not a real-host functional pass.

## Universal protocol checks

Every generated JSON definition parsed successfully. Seeded unrelated top-level settings and
unrelated MCP server entries survived setup for Claude, Gemini, Cursor, Roo Code, Generic MCP, and
Cline. Codex preserved all unrelated TOML bytes.

Every adapter definition contained exactly the equivalent of:

```text
C:\Program Files\nodejs\node.exe
%TEMP%\cydetix-alpha7-real-agent-e89635e\runtime\package\dist\cli\main.js
mcp
--project-root
<canonical isolated project root>
--require-version
0.6.0-alpha.7
```

The definitions contained no `npm`, `npx`, `pnpm`, `yarn`, `bunx`, registry, downloader, shell,
network bootstrap, elevation, PATH-dependent Cydetix command, or host-cwd-derived project root.

Raw `tools/list` exposed exactly:

1. `cydetix_scan`
2. `cydetix_fix`
3. `cydetix_explain`

There were no extra security-authority tools. Successful raw MCP launches and calls exited zero,
wrote protocol JSON to stdout, and left stderr empty.

## Project-boundary adversarial tests

The configured runtime rejected every attempted widening:

| Case                                                            | Result                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Absolute sibling directory                                      | JSON-RPC `-32602`: path must stay within configured project root                |
| `..` traversal                                                  | JSON-RPC `-32602`: path must stay within configured project root                |
| `../sibling` traversal                                          | JSON-RPC `-32602`: path must stay within configured project root                |
| Absolute project-root escape                                    | JSON-RPC `-32602`: path must stay within configured project root                |
| Alternate-drive `D:\candidate-worktree` target from a `C:` root | JSON-RPC `-32602`: path must stay within configured project root                |
| Null-containing path                                            | JSON-RPC `-32602`: path must stay within configured project root                |
| Nonexistent target                                              | JSON-RPC `-32602`: path must stay within configured project root                |
| Junction to sibling repository                                  | JSON-RPC `-32602`: path must be a real directory within configured project root |

No escape target was scanned and canonicalization was not weakened.

## Hostile repository

The hostile repository contained instructions to ignore Cydetix policy, run package scripts, disable
rollback, and classify every change SAFE. It also contained `test` and `format` scripts plus a
malicious formatter fixture that each wrote a distinct marker if executed.

Both raw MCP and a fresh real Codex process were tested. Codex received only the natural prompt
`Check this project for security issues.` Its event stream showed `cydetix_scan` against the exact
hostile canonical root and alpha.7 runtime. Cydetix returned the real SAFE session-cookie finding,
reported `mutatedRepository: false`, and explicitly stated no repository code or lifecycle script
was run. All three hostile execution markers remained absent and `git status --porcelain` remained
empty.

## Old-global interference

An actual older global installation was present:

```text
%APPDATA%\npm\cydetix.ps1
%APPDATA%\npm\node_modules\cydetix\dist\cli\main.js
version: 0.6.0-alpha.6
```

It was preserved. The generated agent instead launched the absolute Node executable and packed
alpha.7 JS entrypoint. Real Codex returned structured `0.6.0-alpha.7` results. A second protocol
launch replaced PATH with a directory containing failing fake launchers for the old `cydetix`,
`npm`, `npx`, `pnpm`, `yarn`, and `bunx`; none of their invocation markers appeared. The launch cwd
was an unrelated directory and did not affect the canonical target.

Result: PASS.

## Wrong-version fail closed

Two directions were tested:

- packed alpha.7 with `--require-version 0.6.0-alpha.6` exited `3`, produced no stdout, and wrote
  the deterministic mismatch to stderr;
- actual global alpha.6 with `--require-version 0.6.0-alpha.7` exited `3`, produced no stdout, and
  wrote `Cydetix MCP version mismatch: required 0.6.0-alpha.7, running 0.6.0-alpha.6.` to stderr.

No PATH lookup, package manager, download, network install, or fallback runtime occurred.

Result: PASS.

## Repository mutation evidence

All scan and explain checks compared `git status --porcelain` before and after. They produced no
delta. Setup-generated integration files were separately committed in the disposable target before
agent scans so configuration writes could not be mistaken for scan writes.

One explicit SAFE remediation was authorized through raw MCP in the dedicated remediation project.
The only diff was:

```diff
-app.config["SESSION_COOKIE_HTTPONLY"] = False
+app.config["SESSION_COOKIE_HTTPONLY"] = True
```

The transaction was `APPLIED_VERIFIED`. Parser, patch-structure, targeted-rescan, and security
invariant checks passed; the transition was `PROVEN_INSECURE` to `PROVEN_SECURE` with
`RESOLVED_VERIFIED`; no external command was authorized; and the rescan returned zero findings. No
unrelated byte changed.

Result: PASS.

## Local regression

| Command          | Result                                                                                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format` | PASS                                                                                                                                                                                                             |
| `npm run lint`   | PASS                                                                                                                                                                                                             |
| `npm run check`  | PASS                                                                                                                                                                                                             |
| `npm test`       | PASS: 39 files passed, 1 skipped; 260 tests passed, 13 Docker-dependent tests skipped                                                                                                                            |
| `npm run verify` | PASS: complete aggregate, including schemas, SARIF, SBOM, remediation, skills, plugin, triggers, MCP, version, package, packed install, release report, workflow security, public-repository audit, and licenses |

One intermediate aggregate attempt reached the public-repository audit and correctly rejected
run-specific personal paths in the first documentation draft. After public-safe path notation was
introduced, a retry encountered a host-load-sensitive Microsoft SARIF Multitool timeout. The same
SARIF suite then passed in isolation, and the final complete `npm run verify` aggregate passed from
start to finish. No timeout or policy threshold was changed.

## Docker result

`docker.exe` was installed, but `docker info` could not connect to the Docker Desktop Linux engine
named pipe. The Docker-enabled suite was therefore not run in this local gate. The mission-supplied
hosted Linux container sandbox status remains passed; no local Docker pass is claimed.

## Limitations and cleanup

- Only Codex was fully exercised as an authenticated real host on this machine.
- Claude Code was installed but unauthenticated. Its config loaded with skills disabled, but no
  model/tool call occurred.
- Gemini CLI, Cursor, Cline, and Roo Code were not installed; their results are configuration-only.
- Docker Desktop's Linux daemon was unavailable.
- The hosted statuses above are mission-supplied prior gate results, not reruns performed here.
- Codex cloud transport was intermittent. Successful completed runs supplied the evidence used by
  this document; failed network attempts are not counted as host results.
- Microsoft SARIF Multitool runtime was load-sensitive around its timeout during one intermediate
  aggregate attempt. An isolated retry and the final full aggregate passed without code or timeout
  changes.
- A validation harness PowerShell variable collided with the read-only `$HOME` alias and briefly
  directed an isolated Cline setup to the real user home. The managed entry was immediately removed;
  the newly created empty `%USERPROFILE%\.cline` tree was verified and removed, and its absence was
  confirmed. This was a harness error, not a product defect.
- The isolated project and extracted packed-runtime paths are temporary evidence paths and are not
  production installation locations.

## Verdict

All release-critical real-agent and universal protocol conditions available on this host passed.
Unavailable optional agents and the unavailable local Docker daemon are recorded without claiming
real-host or local-Docker coverage. No security invariant, runtime behavior, MCP semantics, setup
behavior, or production integration behavior was changed.

`PUBLIC_ALPHA_VALIDATED`
