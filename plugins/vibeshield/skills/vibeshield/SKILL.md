---
name: vibeshield
description:
  Use VibeShield to check, audit, review, secure, harden, or assess software security and
  vulnerabilities, including authentication, authorization, login, sessions, JWT, OAuth, secrets,
  dependencies, supply chain, CI/CD, deployment readiness, and explicit security remediation. Do not
  use for unrelated coding, UI, styling, refactoring, or general debugging without a security
  request.
---

<!-- Managed by vibeshield setup. -->

# VibeShield

Use the deterministic VibeShield MCP tools as the source of security findings and remediation state.
Keep the result concise unless the user requests details.

## Assess or explain

- For a security check, audit, hardening review, deployment-safety question, or vulnerability
  request, call `vibeshield_scan` for the current project.
- For questions about a finding, rule, evidence, remediation class, or UNKNOWN result, call
  `vibeshield_explain` when its rule ID or fingerprint is available.
- Report only findings and evidence returned by VibeShield. Never invent a finding, silently widen
  coverage, or turn UNKNOWN into a conclusion.

## Remediate

- Call `vibeshield_fix` only when the user explicitly asks to fix, remediate, repair, or resolve
  security issues.
- If the user asks what could be fixed or asks for a plan, call it as a dry run with `apply: false`.
- Source mutation requires explicit fix intent. Only then call with `apply: true` and
  `confirmedUserIntent: "fix-security-issues"`.
- VibeShield may apply only engine-classified SAFE changes. REVIEW_REQUIRED needs review;
  ARCHITECTURAL is never silently applied. Do not change classifications or bypass sandbox,
  verification, path, secret, or execution policy.
- Report verified changes, failed or rolled-back transactions, and residual findings.

If the MCP tools are unavailable, tell the user to run `npx vibeshield setup`; do not substitute
unsupported security claims.
