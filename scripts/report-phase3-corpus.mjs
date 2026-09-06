import path from "node:path";

import { scanRepository } from "../dist/core/engine.js";

const cases = [
  ["session-secure", "SESSION_ROTATES_AFTER_AUTHENTICATION", "secure"],
  ["session-fixation", "SESSION_ROTATES_AFTER_AUTHENTICATION", "insecure"],
  ["session-secure", "SESSION_INVALIDATED_ON_LOGOUT", "secure"],
  ["logout-incomplete", "SESSION_INVALIDATED_ON_LOGOUT", "insecure"],
  ["reset-secure", "PASSWORD_RESET_TOKEN_SINGLE_USE", "secure"],
  ["reset-persistent-sessions", "PASSWORD_RESET_TOKEN_SINGLE_USE", "insecure"],
  ["reset-secure", "PASSWORD_RESET_INVALIDATES_RELEVANT_SESSIONS", "secure"],
  ["reset-persistent-sessions", "PASSWORD_RESET_INVALIDATES_RELEVANT_SESSIONS", "insecure"],
  ["reset-unknown", "PASSWORD_RESET_INVALIDATES_RELEVANT_SESSIONS", "unsupported"],
  ["reset-secure", "PASSWORD_RESET_CREDENTIAL_PROTECTED", "secure"],
  ["reset-weak-credential", "PASSWORD_RESET_CREDENTIAL_PROTECTED", "insecure"],
  ["jwt-verified", "JWT_SIGNATURE_VERIFIED", "secure"],
  ["jwt-unverified", "JWT_SIGNATURE_VERIFIED", "insecure"],
  ["false-positive-traps", "JWT_SIGNATURE_VERIFIED", "secure"],
  ["oauth-secure", "OAUTH_STATE_VALIDATED", "secure"],
  ["oauth-broken-state", "OAUTH_STATE_VALIDATED", "insecure"],
  ["oauth-missing-pkce", "OAUTH_STATE_VALIDATED", "secure"],
  ["oauth-secure", "PKCE_REQUIRED_WHERE_APPLICABLE", "secure"],
  ["oauth-missing-pkce", "PKCE_REQUIRED_WHERE_APPLICABLE", "insecure"],
  ["oauth-broken-state", "PKCE_REQUIRED_WHERE_APPLICABLE", "unsupported"],
  ["refresh-rotation", "REFRESH_TOKEN_REPLAY_MITIGATED", "secure"],
];

const reports = new Map();
const counts = new Map();

for (const [fixture, invariantId, expected] of cases) {
  let report = reports.get(fixture);
  if (report === undefined) {
    report = await scanRepository({ path: path.resolve("fixtures", "phase3", fixture) });
    reports.set(fixture, report);
  }
  const result = report.securityAnalysis.authenticationAnalysis?.results.find(
    (candidate) => candidate.invariantId === invariantId,
  );
  if (result === undefined) throw new Error(`Missing ${invariantId} result for ${fixture}.`);
  const current = counts.get(invariantId) ?? {
    truePositives: 0,
    trueNegatives: 0,
    falsePositives: 0,
    knownUnsupported: 0,
    unknownResults: 0,
  };
  if (expected === "insecure" && result.conclusion === "PROVEN_INSECURE")
    current.truePositives += 1;
  else if (expected === "secure" && result.conclusion === "PROVEN_SECURE")
    current.trueNegatives += 1;
  else if (expected !== "insecure" && result.conclusion === "PROVEN_INSECURE")
    current.falsePositives += 1;
  if (expected === "unsupported") current.knownUnsupported += 1;
  if (result.conclusion === "UNKNOWN") current.unknownResults += 1;
  counts.set(invariantId, current);
}

process.stdout.write(
  `${JSON.stringify(
    {
      methodology:
        "Raw curated corpus counts only. The corpus is intentionally too small for precision or recall percentages.",
      cases: cases.length,
      invariants: Object.fromEntries(
        [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)),
      ),
    },
    null,
    2,
  )}\n`,
);
