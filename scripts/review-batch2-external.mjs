import path from "node:path";
import { tmpdir } from "node:os";

import { scanRepository } from "../dist/core/engine.js";

const historicalRoot = path.join(tmpdir(), "cydetix-alpha8-external-corpus-20260911");
const targets = [
  ["OWASP/NodeGoat", path.join(historicalRoot, "nodegoat")],
  ["appsecco/dvna", path.join(historicalRoot, "dvna")],
  ["expressjs/express", path.join(historicalRoot, "express")],
  ["fastify/fastify", path.join(historicalRoot, "fastify")],
  ["Vikas2171/vulnerable-website", path.join(historicalRoot, "vikas-vulnerable-website")],
  ["juice-shop/juice-shop", path.join(historicalRoot, "juice-shop")],
  ["we45/Vulnerable-Flask-App", path.join(historicalRoot, "vulnerable-flask-app")],
  ["stephenbradshaw/breakableflask", path.join(historicalRoot, "breakableflask")],
  ["pallets/flask", path.join(historicalRoot, "flask")],
  ["LevaAverGit/appsec-review-lab-v2", path.join(historicalRoot, "fastapi-appsec-lab")],
  [
    "vercel/nextjs-postgres-auth-starter",
    path.resolve(".cydetix/corpora/batch2-nextjs-postgres-auth-starter"),
  ],
];
const batchTwoRuleIds = new Set(["AS-XSS-001", "AS-REDIRECT-001", "AS-CSRF-001"]);
const now = new Date("2026-09-12T00:00:00.000Z");
const results = [];
const requestedRepositories = process.argv.slice(2);
const selectedTargets =
  requestedRepositories.length === 0
    ? targets
    : targets.filter(([repository]) =>
        requestedRepositories.some((requested) => repository === requested),
      );

if (selectedTargets.length === 0) throw new Error("No requested Batch 2 corpus target matched.");

for (const [repository, target] of selectedTargets) {
  const first = await scanRepository({ path: target, now });
  const second = await scanRepository({ path: target, now });
  const project = (report) => ({
    findings: report.findings.filter((finding) => batchTwoRuleIds.has(finding.ruleId)),
    analysis: report.securityAnalysis.applicationDataflow,
    catalogueFingerprint: report.reproducibility?.ruleCatalogueFingerprint,
    configurationFingerprint: report.reproducibility?.configurationFingerprint,
    suppressionFingerprint: report.reproducibility?.suppressionFingerprint,
  });
  const firstSecurity = project(first);
  const secondSecurity = project(second);
  results.push({
    repository,
    target,
    deterministic: JSON.stringify(firstSecurity) === JSON.stringify(secondSecurity),
    completeness: firstSecurity.analysis?.completeness,
    metrics: firstSecurity.analysis?.metrics,
    findings: firstSecurity.findings.map((finding) => ({
      ruleId: finding.ruleId,
      path: finding.location.path,
      line: finding.location.startLine,
      component: finding.affectedComponent,
      proofState: finding.proofState,
      confidence: finding.confidence,
      analysisCompleteness: finding.analysisCompleteness,
      autofix: finding.autofix,
      source: finding.proof?.source,
      propagationSteps: finding.proof?.propagationPath.length,
      controlEncountered: finding.proof?.securityControlEncountered,
      controlEvaluation: finding.proof?.securityControlEvaluation,
      sink: finding.proof?.sink,
      reachability: finding.proof?.reachability,
    })),
    unknownCounts: [...batchTwoRuleIds]
      .map((ruleId) => ({
        ruleId,
        count: (firstSecurity.analysis?.unknowns ?? []).filter(
          (unknown) => unknown.ruleId === ruleId,
        ).length,
      }))
      .filter((item) => item.count > 0),
    fingerprints: {
      catalogue: firstSecurity.catalogueFingerprint,
      configuration: firstSecurity.configurationFingerprint,
      suppression: firstSecurity.suppressionFingerprint,
    },
  });
}

process.stdout.write(`${JSON.stringify({ scanRepetitions: 2, targets: results }, null, 2)}\n`);
