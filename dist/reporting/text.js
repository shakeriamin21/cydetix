import { terminalSafe } from "./terminal.js";
export function renderFinding(finding) {
    const mapping = [
        ...finding.standards.cwe,
        ...finding.standards.owaspTop10,
        ...finding.standards.asvs,
        ...finding.standards.nist,
    ]
        .map(terminalSafe)
        .join(", ");
    return [
        `${finding.severity.toUpperCase()}  ${terminalSafe(finding.ruleId)}  ${terminalSafe(finding.title)}`,
        `  Location: ${terminalSafe(finding.location.path)}:${finding.location.start.line}:${finding.location.start.column + 1}`,
        `  Confidence: ${finding.confidence}  Reachability: ${finding.reachability}`,
        `  Evidence: ${terminalSafe(finding.evidence[0]?.message ?? "(none)")}`,
        `  Invariant: ${terminalSafe(finding.securityInvariant)}`,
        `  Impact: ${terminalSafe(finding.impact)}`,
        `  Remediation: ${terminalSafe(finding.remediation)}`,
        `  Autofix: ${finding.autofix}`,
        `  Standards: ${mapping || "none"}`,
        `  Fingerprint: ${finding.fingerprint}`,
    ].join("\n");
}
export function renderText(report) {
    const summary = report.summary;
    const lines = [
        `${terminalSafe(report.tool.name)} ${terminalSafe(report.tool.version)}`,
        `Target: ${terminalSafe(report.manifest.root)}`,
        `Findings: ${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low, ${summary.info} info (${summary.suppressed} suppressed)`,
        "",
        "COVERAGE",
        `  Files examined: ${report.manifest.filesExamined} (${report.manifest.bytesExamined} bytes)`,
        `  Files/directories skipped: ${report.manifest.skipped.length}`,
        `  Languages: ${report.manifest.languages.map(terminalSafe).join(", ") || "none detected"}`,
        `  Frameworks: ${report.manifest.frameworks.map(terminalSafe).join(", ") || "none detected"}`,
        `  Analyzed languages: ${report.coverage.analyzedLanguages.map(terminalSafe).join(", ") || "none"}`,
        `  Analyzed frameworks: ${report.coverage.analyzedFrameworks.map(terminalSafe).join(", ") || "none"}`,
        `  Engines run: ${report.coverage.enginesRun.map(terminalSafe).join("; ")}`,
        `  Engines unavailable: ${report.coverage.enginesUnavailable.map(terminalSafe).join("; ")}`,
        `  Rules enabled: ${report.coverage.enabledRuleIds.map(terminalSafe).join(", ")}`,
        "  Limitations:",
        ...report.coverage.limitations.map((limitation) => `    - ${terminalSafe(limitation)}`),
        "",
        `AUTHENTICATION GRAPH: ${report.authGraph.nodes.length} nodes, ${report.authGraph.edges.length} edges`,
        ...report.authGraph.limitations.map((limitation) => `  - ${terminalSafe(limitation)}`),
        "",
        `SECURITY IR: ${report.securityAnalysis.securityIr.modules.length} modules, ${report.securityAnalysis.securityIr.calls.length} calls, ${report.securityAnalysis.securityIr.resourceOperations.length} resource operations`,
        `AUTHORIZATION PROOFS: ${report.securityAnalysis.authorizationProofs.filter((proof) => proof.state === "PROVEN").length} proven, ${report.securityAnalysis.authorizationProofs.filter((proof) => proof.state === "VIOLATED").length} violated, ${report.securityAnalysis.authorizationProofs.filter((proof) => proof.state === "UNKNOWN").length} unknown`,
        ...(report.securityAnalysis.authenticationAnalysis === undefined
            ? []
            : [
                `AUTHENTICATION INVARIANTS: ${report.securityAnalysis.authenticationAnalysis.metrics.provenSecure} proven secure, ${report.securityAnalysis.authenticationAnalysis.metrics.provenInsecure} proven insecure, ${report.securityAnalysis.authenticationAnalysis.metrics.unknown} applicable unknown, ${report.securityAnalysis.authenticationAnalysis.metrics.notApplicable} not applicable`,
            ]),
        ...report.securityAnalysis.securityIr.limitations.map((limitation) => `  - ${terminalSafe(limitation)}`),
        ...(report.securityAnalysis.supplyChainAnalysis === undefined
            ? []
            : [
                "",
                `SUPPLY CHAIN: ${report.securityAnalysis.supplyChainAnalysis.inventory.packages.length} resolved dependencies, advisory state ${report.securityAnalysis.supplyChainAnalysis.advisories.state}`,
                `SECRETS: ${report.securityAnalysis.supplyChainAnalysis.secrets.workingTree}; history ${report.securityAnalysis.supplyChainAnalysis.secrets.history}`,
                `GITHUB ACTIONS: ${report.securityAnalysis.supplyChainAnalysis.ci.actionReferences.length} references across ${report.securityAnalysis.supplyChainAnalysis.ci.workflows.length} workflows`,
            ]),
        "",
    ];
    if (report.findings.length === 0) {
        lines.push("No active findings were produced within the coverage described above.");
    }
    else {
        lines.push(...report.findings.flatMap((finding) => [renderFinding(finding), ""]));
    }
    return `${lines.join("\n").trimEnd()}\n`;
}
//# sourceMappingURL=text.js.map