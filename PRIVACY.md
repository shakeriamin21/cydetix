# Privacy

VibeShield has no telemetry. Normal scans are offline and do not upload source, filenames, findings,
metrics, or credentials. The product does not require an account or API key.

Reports remain on the operator's machine unless the operator redirects, publishes, or uploads them.
Reports can contain repository paths, source excerpts, architecture metadata, and security findings.
Treat them as sensitive artifacts.

Secret detections never reproduce the matched value. They include a one-way SHA-256 fingerprint
prefix, provider/type evidence when known, and a redacted marker. A fingerprint is still correlation
data and should not be published casually.

The composite GitHub Action downloads locked npm dependencies from the configured npm registry and
writes SARIF inside the runner. It does not upload SARIF; upload is a separate workflow decision.
Explicit OSV mode transmits only npm ecosystem, package name, and exact resolved version to
`https://api.osv.dev`; source code, source paths, findings, and credentials are not transmitted.
Provider failure remains explicit.

Local explicit verification receives only a small environment allowlist, but it is not isolated from
host files or network. Container verification adds only fixed VibeShield control variables; the
trusted image may define its own baseline environment. VibeShield does not mount the host home,
cloud credentials, SSH agent, or Docker socket, and its default container network policy is denied.
Phase 6B empirically exercised environment canaries, host-home/host-temp canaries, socket absence,
and in-container DNS/TCP/HTTP/HTTPS attempts on the recorded Docker Desktop/WSL2 host. The result is
runtime-specific evidence, not a claim of protection against container/runtime/kernel compromise.

External-corpus acquisition and npm package installation are explicit development/CI network
operations, separate from scanning. External application source remains in an ignored cache and is
not included in release artifacts. Release reports contain normalized counts, immutable commits,
hashes, and limitations rather than external source or local machine paths.

GitHub artifact/attestation verification and npm installation also use their respective network
services. Source is not sent to npm or GitHub by an ordinary local scan. VibeShield has no hidden
telemetry; feedback uses deliberate GitHub mechanisms after the public repository exists.

Any future telemetry or hosted analysis requires explicit opt-in, documentation, retention controls,
and a new privacy review.
