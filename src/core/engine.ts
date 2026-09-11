import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import { buildAuthenticationGraph } from "../auth-graph/model.js";
import { buildAuthorizationProofs } from "../authorization-analysis/proof.js";
import { buildAuthenticationAnalysis } from "../authentication-analysis/invariants.js";
import {
  isParseFailure,
  parseSource,
  type ParseFailure,
  type ParsedSource,
} from "../ast-analysis/parser.js";
import { PRODUCT } from "./brand.js";
import { buildSecurityIr } from "../call-graph/builder.js";
import { enrichSecurityFacts } from "../dataflow-analysis/security-facts.js";
import { analyzeApplicationDataflow } from "../dataflow-analysis/bounded-engine.js";
import {
  scanReportSchema,
  type CydetixConfig,
  type Finding,
  type ScanReport,
  type Severity,
} from "./schema.js";
import { createBoundary } from "../repository-discovery/boundary.js";
import { loadConfig } from "../repository-discovery/config.js";
import { inspectPassiveGitMetadata } from "../repository-discovery/git-metadata.js";
import { buildRepositoryManifest } from "../repository-discovery/discover.js";
import { traverseRepository } from "../repository-discovery/traverse.js";
import { REPOSITORY_SECURITY_RULES, SECURITY_RULES } from "../rules/index.js";
import { buildSupplyChainFindings } from "../rules/supply-chain.js";
import { buildApplicationDataflowFindings } from "../rules/application-dataflow.js";
import { securityIrSchema } from "../security-ir/model.js";
import { buildSupplyChainAnalysis } from "../supply-chain/engine.js";
import type { AdvisoryProvider } from "../supply-chain/advisories.js";
import { RULES, ruleCatalogueFingerprint } from "../rule-engine/catalogue.js";
import { stableObjectFingerprint } from "./hash.js";

export interface ScanOptions {
  readonly path: string;
  readonly now?: Date;
  readonly advisories?: "offline" | "online";
  readonly advisoryProvider?: AdvisoryProvider;
  readonly history?: boolean;
}

function scopeMatches(scope: string, filePath: string): boolean {
  const clean = scope.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
  return clean === "." || clean === "*" || filePath === clean || filePath.startsWith(`${clean}/`);
}

function applyAcceptedRisk(
  findings: readonly Finding[],
  config: CydetixConfig,
  now: Date,
): { findings: Finding[]; suppressedFindings: Finding[] } {
  const active: Finding[] = [];
  const suppressed: Finding[] = [];
  const today = now.toISOString().slice(0, 10);

  for (const finding of findings) {
    if (config.baseline.includes(finding.fingerprint)) {
      suppressed.push({
        ...finding,
        suppression: {
          rule: finding.ruleId,
          findingFingerprint: finding.fingerprint,
          scope: finding.location.path,
          reason: "Existing finding recorded in baseline",
          owner: "baseline",
        },
      });
      continue;
    }
    const exception = config.suppressions.find(
      (candidate) =>
        candidate.rule === finding.ruleId &&
        (candidate.fingerprint === undefined || candidate.fingerprint === finding.fingerprint) &&
        scopeMatches(candidate.scope, finding.location.path) &&
        (candidate.expires === undefined || candidate.expires >= today),
    );
    if (exception === undefined) {
      active.push(finding);
    } else {
      suppressed.push({
        ...finding,
        suppression: {
          rule: exception.rule,
          findingFingerprint: finding.fingerprint,
          scope: exception.scope,
          reason: exception.reason,
          owner: exception.owner,
          created: exception.created,
          ...(exception.expires === undefined ? {} : { expires: exception.expires }),
        },
      });
    }
  }
  return { findings: active, suppressedFindings: suppressed };
}

function summarize(findings: readonly Finding[], suppressed: number): ScanReport["summary"] {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  return { ...counts, suppressed };
}

export async function scanRepository(options: ScanOptions): Promise<ScanReport> {
  const started = options.now ?? new Date();
  const scanId = randomUUID();
  const repositoryDiscoveryStart = performance.now();
  const boundary = await createBoundary(options.path);
  const config = await loadConfig(boundary);
  const traversal = await traverseRepository(boundary, config);
  const manifest = buildRepositoryManifest(traversal);
  const gitMetadata = await inspectPassiveGitMetadata(boundary.root);
  const repositoryDiscoveryMilliseconds = performance.now() - repositoryDiscoveryStart;
  const parsingStart = performance.now();
  const parseFailures: ParseFailure[] = [];
  const parsedByPath = new Map<string, ParsedSource>();

  for (const file of traversal.files) {
    const result = parseSource(file);
    if (result === undefined) continue;
    if (isParseFailure(result)) parseFailures.push(result);
    else parsedByPath.set(file.relativePath, result);
  }
  const parsingMilliseconds = performance.now() - parsingStart;
  const rawFindings: Finding[] = [];
  const callGraphStart = performance.now();
  const baseSecurityIr = buildSecurityIr(traversal.files, parsedByPath);
  const callGraphMilliseconds = performance.now() - callGraphStart;
  const securityGraphStart = performance.now();
  const applicationSecurityIr = enrichSecurityFacts(baseSecurityIr, traversal.files, parsedByPath);
  const authorizationProofs = buildAuthorizationProofs(applicationSecurityIr);
  const securityGraphMilliseconds = performance.now() - securityGraphStart;
  const applicationDataflowStart = performance.now();
  const applicationDataflowResult = analyzeApplicationDataflow(traversal.files, parsedByPath);
  const applicationDataflowMilliseconds = performance.now() - applicationDataflowStart;
  const supplyChainResult = await buildSupplyChainAnalysis(traversal.files, {
    root: boundary.root,
    advisoryMode: options.advisories ?? "offline",
    ...(options.advisoryProvider === undefined
      ? {}
      : { advisoryProvider: options.advisoryProvider }),
    history: options.history ?? false,
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const securityIr = securityIrSchema.parse({
    ...applicationSecurityIr,
    supplyChain: supplyChainResult.analysis.ir,
  });
  const invariantEvaluationStart = performance.now();
  const authenticationAnalysis = buildAuthenticationAnalysis(
    securityIr,
    manifest,
    traversal.files,
    parsedByPath,
  );
  const invariantEvaluationMilliseconds = performance.now() - invariantEvaluationStart;
  const repositoryContext = {
    files: traversal.files,
    securityIr,
    authorizationProofs,
    authenticationAnalysis,
  };
  for (const rule of REPOSITORY_SECURITY_RULES)
    rawFindings.push(...rule.analyze(repositoryContext));
  rawFindings.push(...buildSupplyChainFindings(supplyChainResult, traversal.files));
  rawFindings.push(...buildApplicationDataflowFindings(applicationDataflowResult));

  for (const file of traversal.files) {
    const context = { file, parsed: parsedByPath.get(file.relativePath) };
    for (const rule of SECURITY_RULES) rawFindings.push(...rule.analyze(context));
  }
  const correlatedFindings = [
    ...new Map(rawFindings.map((finding) => [finding.fingerprint, finding])).values(),
  ];
  correlatedFindings.sort((left, right) => {
    const pathComparison = left.location.path.localeCompare(right.location.path);
    return pathComparison === 0
      ? left.location.start.offset - right.location.start.offset
      : pathComparison;
  });
  const acceptedRisk = applyAcceptedRisk(correlatedFindings, config, started);
  const completed = new Date();
  const supportedFrameworks = new Set(RULES.flatMap((rule) => rule.supportedFrameworks));
  const unsupportedFrameworks = manifest.frameworks.filter(
    (framework) => !supportedFrameworks.has(framework),
  );
  const authenticationGraphStart = performance.now();
  const authGraph = buildAuthenticationGraph(
    manifest,
    traversal.files,
    securityIr,
    authorizationProofs,
    authenticationAnalysis,
  );
  const authenticationGraphMilliseconds = performance.now() - authenticationGraphStart;
  const reportGenerationStart = performance.now();
  const traversalTruncated = traversal.baseManifest.skipped.some((item) =>
    ["too_large", "depth_limit", "file_limit"].includes(item.reason),
  );
  const overallCompleteness =
    traversalTruncated || applicationDataflowResult.analysis.completeness === "TRUNCATED"
      ? "TRUNCATED"
      : parseFailures.length > 0 || applicationDataflowResult.analysis.completeness === "PARTIAL"
        ? "PARTIAL"
        : applicationDataflowResult.analysis.completeness === "UNSUPPORTED"
          ? "PARTIAL"
          : "COMPLETE";
  const report: ScanReport = {
    schemaVersion: PRODUCT.reportSchemaVersion,
    tool: { name: PRODUCT.id, version: PRODUCT.version },
    scan: {
      id: scanId,
      startedAt: started.toISOString(),
      completedAt: completed.toISOString(),
      offline: (options.advisories ?? "offline") === "offline",
      mutatedRepository: false,
      performanceMilliseconds: {
        repositoryDiscovery: repositoryDiscoveryMilliseconds,
        parsing: parsingMilliseconds,
        callGraph: callGraphMilliseconds,
        securityGraph: securityGraphMilliseconds,
        authenticationGraph: authenticationGraphMilliseconds,
        invariantEvaluation: invariantEvaluationMilliseconds,
        applicationDataflow: applicationDataflowMilliseconds,
        reportGeneration: 0,
      },
    },
    manifest,
    authGraph,
    securityAnalysis: {
      schemaVersion: "1.0.0",
      securityIr,
      authorizationProofs,
      authenticationAnalysis,
      supplyChainAnalysis: supplyChainResult.analysis,
      applicationDataflow: applicationDataflowResult.analysis,
    },
    coverage: {
      tier: "phase-four",
      analyzedLanguages: manifest.languages.filter((language) =>
        ["javascript", "typescript", "python"].includes(language),
      ),
      analyzedFrameworks: manifest.frameworks.filter((framework) =>
        supportedFrameworks.has(framework),
      ),
      enginesRun: [
        "bounded repository discovery",
        "Babel JavaScript/TypeScript AST",
        "Lezer Python syntax tree",
        "deterministic Cydetix rule engine",
        "bounded application source-propagation-control-sink engine",
        "authentication graph (literal/dependency evidence)",
        "Security IR and repository-local ESM call graph",
        "Express identity trust and Prisma resource-flow analysis",
        "object-level authorization proof engine",
        "tenant-isolation proof engine",
        "Authentication Graph v2 and authentication protocol adapters",
        "authentication invariant proof engine",
        "npm package-lock dependency inventory and Package URL normalization",
        "passive redacted secret exposure engine",
        "GitHub Actions trust-boundary analysis",
        "CycloneDX 1.7 SBOM model",
        ...(options.history === true ? ["bounded Git object history inspection"] : []),
        ...((options.advisories ?? "offline") === "online"
          ? [`${supplyChainResult.analysis.advisories.provider} advisory provider`]
          : []),
      ],
      enginesUnavailable: [
        "Semgrep adapter (ROADMAP; not invoked)",
        "Gitleaks adapter (ROADMAP; not invoked)",
        "Cosign adapter (optional foundation; not invoked)",
        ...((options.advisories ?? "offline") === "offline"
          ? ["OSV advisory provider (NOT_CHECKED_OFFLINE)"]
          : supplyChainResult.analysis.advisories.state === "PROVIDER_UNAVAILABLE"
            ? ["OSV advisory provider (PROVIDER_UNAVAILABLE)"]
            : []),
      ],
      enabledRuleIds: RULES.map((rule) => rule.id),
      analysisCompleteness: [
        {
          engine: "repository-discovery",
          status: traversalTruncated ? "TRUNCATED" : "COMPLETE",
          details: traversalTruncated
            ? "One or more configured file, size, or depth bounds were reached."
            : "Repository traversal completed within configured bounds.",
        },
        {
          engine: "syntax-parsing",
          status: parseFailures.length === 0 ? "COMPLETE" : "PARTIAL",
          details:
            parseFailures.length === 0
              ? "All supported source files parsed successfully."
              : `${parseFailures.length} supported source file(s) failed parsing.`,
        },
        {
          engine: "application-dataflow",
          status: applicationDataflowResult.analysis.completeness,
          details: `${applicationDataflowResult.analysis.metrics.pathsConsidered} bounded path(s) considered; ${applicationDataflowResult.analysis.metrics.truncationEvents} truncation event(s).`,
        },
      ],
      limitations: [
        "Only explicit, evidence-backed supported patterns are evaluated; absence of findings is not a security guarantee.",
        gitMetadata.limitation,
        "Python analysis validates syntax but phase-one Python rules use exact configuration/call patterns rather than semantic name resolution.",
        "No repository code, lifecycle script, hook, build, test, container, or network operation was executed.",
        ...(options.history === true
          ? []
          : ["Git history was not analyzed; use cydetix secrets . --history."]),
        ...((options.advisories ?? "offline") === "offline"
          ? [
              "Dependency advisories were NOT_CHECKED_OFFLINE; this is not a zero-vulnerability result.",
            ]
          : []),
        "Generated code, runtime configuration, and dependency function reachability were not analyzed.",
        ...(unsupportedFrameworks.length === 0
          ? []
          : [
              `Reduced coverage: no framework-specific rules support ${unsupportedFrameworks.join(", ")}.`,
            ]),
        ...parseFailures.slice(0, 20).map((failure) => `${failure.path}: ${failure.message}`),
        ...(parseFailures.length > 20
          ? [`${parseFailures.length - 20} additional parse failures omitted from this summary.`]
          : []),
      ],
    },
    reproducibility: {
      schemaVersion: "1.0.0",
      cydetixVersion: PRODUCT.version,
      ruleCatalogueFingerprint: ruleCatalogueFingerprint(),
      enabledRules: RULES.map((rule) => ({ id: rule.id, version: rule.version })).sort(
        (left, right) => left.id.localeCompare(right.id),
      ),
      configurationFingerprint: stableObjectFingerprint(config),
      suppressionFingerprint: stableObjectFingerprint({
        baseline: [...config.baseline].sort(),
        suppressions: [...config.suppressions].sort((left, right) =>
          `${left.rule}:${left.scope}:${left.fingerprint ?? ""}`.localeCompare(
            `${right.rule}:${right.scope}:${right.fingerprint ?? ""}`,
          ),
        ),
      }),
      canonicalRepositoryRoot: boundary.root,
      gitCommit: gitMetadata.commit,
      workingTreeState: gitMetadata.workingTreeState,
      detectedLanguages: [...manifest.languages].sort(),
      detectedFrameworks: [...manifest.frameworks].sort(),
      dependencyContext: [
        ...manifest.packageManagers,
        ...manifest.ormAndDatabases,
        ...manifest.authenticationLibraries,
      ].sort(),
      advisoryMode: (options.advisories ?? "offline") === "offline" ? "OFFLINE" : "ONLINE",
      scanId,
      analysisTimestamp: started.toISOString(),
      analysisCompleteness: overallCompleteness,
    },
    findings: acceptedRisk.findings,
    suppressedFindings: acceptedRisk.suppressedFindings,
    summary: summarize(acceptedRisk.findings, acceptedRisk.suppressedFindings.length),
  };
  const validated = scanReportSchema.parse(report);
  if (validated.scan.performanceMilliseconds !== undefined) {
    validated.scan.performanceMilliseconds.reportGeneration =
      performance.now() - reportGenerationStart;
  }
  return scanReportSchema.parse(validated);
}
