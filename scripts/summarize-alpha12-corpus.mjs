import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const manifest = JSON.parse(await readFile("validation/alpha12/corpus-manifest.json", "utf8"));
const runs = JSON.parse(await readFile("validation/alpha12/corpus-results.json", "utf8"));
const locations = JSON.parse(await readFile(".cydetix/alpha12/corpus-paths.json", "utf8"));
const sha = (value) => createHash("sha256").update(value).digest("hex");
// Explicit implementation-time source reviews. These are not inferred from repository comments.
const reviewedFlows = {
  "antony-vulnerable-flask": {
    37: "request.form username -> f-string SQL -> sqlite cursor.execute",
    57: "request.args username -> SQL variable -> sqlite cursor.execute",
    65: "request.args target -> shell command -> os.system",
  },
  breakableflask: {
    468: "POST request.form name -> percent-format HTML template -> render_template_string; template source itself is attacker influenced",
  },
  "fastapi-appsec-lab": {
    39: "FastAPI q parameter -> interpolated SQL structure -> sqlite connection.execute",
  },
  "simple-ssrf": {
    47: "request.args website -> requests.get URL; truthiness check is not a destination policy",
  },
  "vikas-vulnerable-website": {
    117: "POST shell operation under global session middleware; no route-bound anti-CSRF control",
    120: "request.body host -> template shell command -> imported exec",
    170: "request query searchTerm -> raw HTML response",
    197: "request.body comment -> raw HTML response",
    228: "request recipient -> HTML response without HTML encoding",
    231: "POST session balance mutation with ambient session credentials and no route-bound anti-CSRF control",
    259: "request.body recipient -> raw HTML response",
    267: "request.body url -> server fetch without destination policy",
    302: "request.body url remains unencoded in response HTML even though responseContent is escaped",
    309: "request.body username/password -> SQL template -> mysql query without separate parameters",
  },
  "vulnerable-typescript": {
    90: "request.query host -> imported exec shell command",
    104: "request.query filename -> path.join -> fs.readFile; joining alone is not authorized-root confinement",
    117: "request.query query -> res.send HTML body without encoding",
    125: "request.query url -> axios.default.get without destination policy",
    239: "request.query url -> local url alias -> res.redirect; no approved destination policy",
  },
};
const unsupportedReviews = [
  {
    repositoryId: "flask-sqlinjection",
    paths: ["src/flask_app.py", "src/db.py"],
    classification: "UNSUPPORTED_PATTERN",
    explanation:
      "Route path parameter is passed to an imported Python helper before SQL execution. Cross-file/function Python propagation is outside the declared envelope; this is not counted as a supported-pattern FN.",
  },
  {
    repositoryId: "payatu-vuln-node",
    paths: ["routes/app.js", "controllers/vuln_controller.js"],
    classification: "UNSUPPORTED_PATTERN_AND_RESOURCE_BOUND",
    explanation:
      "CommonJS imported controllers, router.route chaining and custom authentication are outside supported cross-file ESM propagation; full scan also exhausts repository AST coverage.",
  },
  {
    repositoryId: "sirappsec-vuln-node",
    paths: ["src/router/routes/system.js"],
    classification: "UNSUPPORTED_PATTERN_AND_RESOURCE_BOUND",
    explanation:
      "Routes are constructed inside a CommonJS exported app factory with locally loaded sink aliases. Full scan exhausts repository AST coverage. These cases are not used to claim supported recall.",
  },
  {
    repositoryId: "vulnerable-typescript",
    paths: ["src/server.ts"],
    classification: "NEGATIVE_SOURCE_REVIEW",
    explanation:
      "The SQL-looking string at lines 72-74 is only logged; no SQL execution sink exists in that route. Lack of AS-INJECTION-SQL-001 there is not a FN. Math.random token, ReDoS and prototype pollution examples are outside the current rule families.",
  },
  {
    repositoryId: "strapi",
    paths: [
      "packages/core/admin/admin/src/pages/Auth/components/ResetPassword.tsx",
      "packages/plugins/i18n/admin/src/components/CreateLocale.tsx",
    ],
    classification: "UNSUPPORTED_SCOPE_AND_RESOURCE_BOUND",
    explanation:
      "Babel cannot build scopes for these type/value duplicate declarations. They are file-local parse failures; Strapi/Koa factory and plugin behavior is not a supported authorization adapter. Identity recursion is explicitly bounded.",
  },
];
const repositories = [];
const totals = {
  findings: 0,
  confirmedFalseInsecureBeforeCorrection: 3,
  unresolvedConfirmedFalseInsecure: 0,
  supportedPatternFalseNegativesDiscovered: 0,
  unadjudicatedFindings: 0,
  unknown: { applicationDataflow: 0, authorization: 0, authentication: 0, findingProof: 0 },
  resourceBoundRepositories: 0,
};
const causeCounts = new Map();
for (const target of manifest.targets) {
  const evidencePath = `validation/alpha12/corpus/${target.id}.json`;
  const report = JSON.parse(await readFile(evidencePath, "utf8"));
  if (report.determinism !== "PASSED" || report.measurements?.length !== 2)
    throw new Error(`Missing deterministic scan pair: ${target.id}`);
  const reviews = [];
  for (const finding of report.findings) {
    const source = await readFile(path.join(locations[target.id], finding.location.path), "utf8");
    const line = source.split("\n")[finding.location.start.line - 1] ?? "";
    let classification = "UNADJUDICATED";
    let rationale = "Independent source review is outstanding.";
    if (
      finding.ruleId === "AS-CI-001" &&
      /uses\s*:/u.test(line) &&
      !/@[a-f0-9]{40}(?:\s|#|$)/iu.test(line)
    ) {
      classification = "VALID_POLICY_OBSERVATION";
      rationale =
        "Source location names a mutable external Action reference. This confirms the immutable-pinning policy observation, not malicious code or runtime exploitation.";
    } else if (finding.ruleId === "AS-SESSION-001" && /false/iu.test(line)) {
      classification = finding.location.path.startsWith("tests/")
        ? "VALID_TEST_CONFIGURATION_OBSERVATION"
        : "VALID_CONFIGURATION_OBSERVATION";
      rationale =
        "Explicit false session-cookie configuration is present. Test-only settings are not counted as deployed application vulnerabilities; production use is not inferred.";
    } else if (finding.ruleId === "AS-PASSWORD-001" && finding.proofState === "UNKNOWN") {
      classification = "VALID_OBSERVATION_WITH_UNKNOWN_PURPOSE";
      rationale =
        target.id === "flask-security"
          ? "Confirmed prior false insecure conclusion: SHA-1 prefix/suffix are used for a k-anonymous breach lookup in utils.py:1439-1468, not credential storage. Current proof is UNKNOWN."
          : "Hash operation is observed; storage purpose is outside the adapter's proof. Observation retained with ARCHITECTURAL ceiling and UNKNOWN conclusion.";
    } else if (finding.ruleId === "AS-SECRET-001" && finding.proofState === "UNKNOWN") {
      classification =
        target.id === "vulnerable-typescript" ? "PLACEHOLDER_MARKER_UNKNOWN" : "KEY_MARKER_UNKNOWN";
      rationale =
        target.id === "vulnerable-typescript"
          ? "Confirmed prior false insecure conclusion: .env contains header placeholders without complete key blocks. Current proof retains only an UNKNOWN marker observation."
          : "Key header is present. NodeGoat/Axios are test key locations; Juice Shop contains embedded encoded blocks. The lexical detector does not prove key validity, deployment or active credentials. All material remains redacted; no active validation.";
    } else if (reviewedFlows[target.id]?.[finding.location.start.line]) {
      classification = "SUPPORTED_FLOW_CONFIRMED_STATIC";
      rationale = reviewedFlows[target.id][finding.location.start.line];
    }
    if (classification === "UNADJUDICATED") totals.unadjudicatedFindings++;
    reviews.push({
      fingerprint: finding.fingerprint,
      ruleId: finding.ruleId,
      path: finding.location.path,
      line: finding.location.start.line,
      sourceFileSha256: sha(source),
      classification,
      rationale,
    });
  }
  const unknown = report.measurements[0].unknown;
  for (const key of Object.keys(totals.unknown)) totals.unknown[key] += unknown[key];
  for (const item of Object.values(report.unknowns).flat()) {
    const cause =
      item.reason ?? item.explanation ?? item.message ?? item.invariant ?? "Unclassified UNKNOWN";
    const text = typeof cause === "string" ? cause : JSON.stringify(cause);
    causeCounts.set(text, (causeCounts.get(text) ?? 0) + 1);
  }
  totals.findings += report.findings.length;
  if (report.completeness === "TRUNCATED") totals.resourceBoundRepositories++;
  repositories.push({
    id: target.id,
    repository: target.repository,
    commit: target.commit,
    language: target.language,
    framework: target.framework,
    evidence: evidencePath,
    evidenceSha256: sha(await readFile(evidencePath)),
    determinism: report.determinism,
    scansCompleted: 2,
    findings: reviews,
    unknown,
    completeness: report.completeness,
    resourceLimitEvents: report.resourceLimitEvents,
    durationMilliseconds: report.measurements.map((m) => m.totalScanMilliseconds),
    unsupportedPatterns: unsupportedReviews.filter((r) => r.repositoryId === target.id),
    limitation:
      "No findings or COMPLETE means only the declared static envelope was processed. This is not whole-repository ground truth or a security guarantee.",
  });
}
const result = {
  schemaVersion: "1.0.0",
  sourceCommit: runs.sourceCommit,
  version: "0.6.0-alpha.12",
  reviewMethod:
    "Implementation-agent static source review and independent source-line checks; no target execution and no independent human audit. Emitted-finding review is separate from selective source inspection for missed supported patterns.",
  groundTruth: "INCOMPLETE",
  recall: null,
  accuracy: null,
  totals,
  falseInsecureCorrections: [
    {
      id: "FP-PASSWORD-PURPOSE",
      repositoryId: "flask-security",
      path: "flask_security/utils.py",
      line: 1455,
      count: 1,
      correction: "AS-PASSWORD-001@1.0.1 UNKNOWN purpose",
    },
    {
      id: "FP-KEY-PLACEHOLDER",
      repositoryId: "vulnerable-typescript",
      path: ".env",
      lines: [53, 54],
      count: 2,
      correction: "AS-SECRET-001@1.0.1 UNKNOWN key material",
    },
  ],
  supportedPatternFnScope:
    "No supported-pattern FN was discovered in the explicitly reviewed local flow cases and selective source reviews listed here. Ground truth is incomplete; this is not a claim of zero corpus-wide false negatives, complete recall, or accuracy. Unsupported constructs, resource-bound omissions, missing password-purpose semantics and fixture-only observations are accounted separately.",
  unsupportedReviews,
  unknownCauses: [...causeCounts]
    .map(([cause, count]) => ({ cause, count }))
    .sort((a, b) => b.count - a.count || a.cause.localeCompare(b.cause)),
  repositories,
};
await writeFile(
  "validation/alpha12/corpus-adjudication.json",
  `${JSON.stringify(result, null, 2)}\n`,
);
const table = repositories
  .map(
    (r) =>
      `| ${r.repository} | ${r.commit} | ${r.findings.length} | ${Object.values(r.unknown).reduce((a, b) => a + b, 0)} | ${r.completeness} | ${r.durationMilliseconds.map((v) => (v / 1000).toFixed(2)).join(" / ")} |`,
  )
  .join("\n");
await writeFile(
  "docs/security/ALPHA12_CORPUS.md",
  `# Alpha.12 pinned corpus evidence\n\nThirty immutable repositories expand the eleven-target alpha.11 Batch 2 corpus. Every target completed two full-report deterministic offline scans. Full findings, UNKNOWN records, engine completeness, limits and metrics are in validation/alpha12/corpus; source reviews are in corpus-adjudication.json. Acquisition alone uses Git network access; analysis never installs dependencies or executes target code.\n\n| Repository | Immutable commit | Findings | UNKNOWN instances | Completeness | Scan seconds (pair) |\n| --- | --- | ---: | ---: | --- | --- |\n${table}\n\nUNKNOWN counts sum independent engines plus finding proof and can refer to the same code. They are not unique vulnerabilities. All ${totals.findings} emitted observations have implementation-time review records; ${totals.unadjudicatedFindings} remain unadjudicated. There is no independent human review or complete ground truth. Three false insecure conclusions were found and corrected to retained UNKNOWN observations: Flask-Security breach lookup (one) and placeholder key headers (two). Test-cookie settings and test keys are explicitly distinguished from deployed vulnerabilities.\n\nNo supported-pattern FN was discovered within the listed selective source reviews. No corpus-wide recall or accuracy is reported. CommonJS controller/factory composition, cross-file Python helpers, unsupported scopes and resource-bounded omissions remain separate limitations. The external redirect at vulnerable-typescript src/server.ts:239 establishes request.query -> alias -> res.redirect without destination policy in the reviewed source.\n\n${totals.resourceBoundRepositories} repositories have TRUNCATED overall analysis. The Strapi parser and recursive identity issues, and Juice Shop/Strapi processing costs, were discovered by unsuccessful exploratory runs retained as development discoveries rather than discarded targets. Numeric AST/application bounds remain intact; security identity propagation now explicitly enforces eight iterations/10000 facts and discards incomplete trust. Corpus timing pairs are descriptive; controlled twenty-sample comparisons are recorded separately in performance.json.\n\nThe full-report replay normalizes only documented UUID/time/root metadata. It compares findings, proofs, uncertainty, limits and fingerprints, not merely counts. Raw source is not redistributed; durable records include immutable source identities, source-file hashes for adjudications and normalized report digests.\n`,
);
process.stdout.write(
  `${repositories.length} deterministic pairs; ${totals.findings} observations; ${totals.unadjudicatedFindings} unadjudicated; ${JSON.stringify(totals.unknown)}\n`,
);
