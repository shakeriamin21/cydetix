# Security model

Cydetix treats the selected repository as hostile data.

## What it reads

Ordinary scans read bounded regular text files beneath the canonical repository root. They skip
symlinks/reparse-point links, archives, binaries, oversized files, ignored build/dependency trees,
and paths beyond configured file/depth limits. Lockfiles, manifests, workflow YAML, Git patches in
explicit history mode, and repository configuration are parsed as data.

## What it writes

`scan`, `auth`, `dependencies`, `secrets`, `supply-chain`, and `sbom` do not modify target source.
`fix` is explicit mutation intent and may change only an engine-generated SAFE target after
canonical path, regular-file, dirty-state, identity, whole-file hash, and exact vulnerable-range
checks. It uses a sibling temporary file, atomic replacement, postcondition rescan, and hash-guarded
rollback. Reports and release evidence are written only where the operator explicitly redirects them
or where project development scripts use the ignored `.cydetix/` workspace.

## When code executes

Repository content never authorizes execution. No ordinary scan runs application code, package
scripts, Git hooks, formatters, builds, tests, Dockerfiles, or repository instructions. Verification
commands must arrive as explicit structural CLI arguments or another trusted external policy.

`LOCAL_EXPLICIT` is a bounded, non-shell subprocess with a sanitized environment, but it is not a
filesystem, network, or process sandbox. `CONTAINER_SANDBOX` requires an explicitly selected,
already-present image pinned by SHA-256. It never pulls an image or silently falls back locally.
Capability results are `AVAILABLE_HARDENED`, `AVAILABLE_DEGRADED`, `UNAVAILABLE`, or
`MISCONFIGURED`.

The container provider uses a Cydetix-created text-only ephemeral repository copy, UID/GID 65534,
network none, read-only container root, limited tmpfs, no Docker/SSH socket, no privileged mode, all
capabilities dropped, no-new-privileges, runtime-default seccomp, one CPU, 512 MiB combined
memory/swap, 128 PIDs, time and aggregate two-megabyte output bounds, and fixed host-environment
forwarding (`CI=true` and `CYDETIX_VERIFICATION=1`). The explicitly trusted image can define its own
baseline environment. Capability is not inferred from the Docker executable: the daemon must report
Linux, memory, PID, and seccomp support and successfully execute the complete hardened profile using
the image's `/bin/true`. The image entrypoint is cleared so it cannot intercept the structurally
authorized executable.

Phase 6B executed the adversarial integration suite on Docker Desktop/WSL2. In-container commands
proved DNS/TCP/HTTP/HTTPS denial; synthetic environment, host-home, and host-temp canary isolation;
effective UID/capability/no-new-privileges/seccomp/cgroup controls; read-only root and bounded
tmpfs; timeout/container removal; PID, memory, and output enforcement; workspace cleanup; no local
fallback; sandboxed remediation; rollback; and output non-retention. Docker/runtime isolation is
defense in depth, not a perfect security boundary. The writable ephemeral workspace bind mount has
no independent byte quota, and container-runtime/kernel escape resistance is not claimed.

## When network is used

There is no telemetry. Ordinary static scanning and remediation planning are offline. Explicit OSV
mode sends npm ecosystem, package name, and exact resolved version to `https://api.osv.dev`; it does
not send source, paths, findings, or secrets. Package installation or corpus acquisition performed
by development/CI is separate from scanning. Container verification denies network in the hardened
profile.

Release networking is separate and explicit: npm installation/audit, online OSV, upstream corpus
acquisition, GitHub workflow queries, npm Trusted Publishing, and attestation verification contact
their respective services. The tag-triggered workflow first runs read-only verification with no
publish permission. A separate protected-environment job receives only the GitHub permissions and
OIDC identity needed for attestations, npm trusted publication, and a prerelease. Pull requests do
not enter that job or receive release authority.

## Secrets and reports

Normalized secret objects have no plaintext field. Reports use redacted previews and stable
fingerprints. Error, terminal, SARIF, history, remediation, sandbox, and external-tool paths are
tested against value or control-sequence leakage. Debug behavior does not disable redaction.

## Fix meanings

- `SAFE`: deterministic, bounded, automatically provable edit.
- `REVIEW_REQUIRED`: useful proposal whose semantics or authoritative resolution require review.
- `ARCHITECTURAL`: design/incident work, not an automatic source patch.
- `APPLIED_VERIFIED`: patch, authorized checks, rescan, and invariant postcondition all passed.

Any unavailable sandbox, failed command, insecure/unknown postcondition, or rollback remains a
failed/unverified remediation state. Read [THREAT_MODEL.md](../THREAT_MODEL.md) for the detailed
threat analysis and [LIMITATIONS.md](LIMITATIONS.md) before deployment.
