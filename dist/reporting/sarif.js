import { RULE_BY_ID } from "../rule-engine/catalogue.js";
function sarifLevel(severity) {
    if (severity === "critical" || severity === "high")
        return "error";
    if (severity === "medium")
        return "warning";
    return "note";
}
function securitySeverity(severity) {
    const values = {
        critical: "9.5",
        high: "8.0",
        medium: "5.5",
        low: "3.0",
        info: "0.0",
    };
    return values[severity];
}
function sarifRule(rule) {
    return {
        id: rule.id,
        name: rule.id.replaceAll("-", "_"),
        shortDescription: { text: rule.title },
        fullDescription: { text: rule.description },
        help: { text: rule.remediation, markdown: rule.remediation },
        helpUri: rule.references[0],
        defaultConfiguration: { level: sarifLevel(rule.severity) },
        properties: {
            tags: [rule.category, ...rule.standards.cwe, ...rule.standards.owaspTop10],
            precision: rule.confidence,
            "security-severity": securitySeverity(rule.severity),
            asvs: rule.standards.asvs,
            nist: rule.standards.nist,
            supplyChainStandards: rule.supplyChainStandards ?? [],
        },
    };
}
function sarifResult(finding) {
    const codeFlows = finding.evidencePath === undefined
        ? undefined
        : [
            {
                message: { text: "VibeShield repository-wide security evidence path" },
                threadFlows: [
                    {
                        locations: finding.evidencePath.map((step) => ({
                            nestingLevel: step.order,
                            location: {
                                message: { text: step.message },
                                physicalLocation: {
                                    artifactLocation: { uri: step.location.path, uriBaseId: "%SRCROOT%" },
                                    region: {
                                        startLine: step.location.start.line,
                                        startColumn: step.location.start.column + 1,
                                        endLine: step.location.end.line,
                                        endColumn: step.location.end.column + 1,
                                    },
                                },
                            },
                        })),
                    },
                ],
            },
        ];
    return {
        ruleId: finding.ruleId,
        level: sarifLevel(finding.severity),
        message: {
            text: `${finding.title}. ${finding.evidence[0]?.message ?? ""}`.trim(),
        },
        locations: [
            {
                physicalLocation: {
                    artifactLocation: { uri: finding.location.path, uriBaseId: "%SRCROOT%" },
                    region: {
                        startLine: finding.location.start.line,
                        startColumn: finding.location.start.column + 1,
                        endLine: finding.location.end.line,
                        endColumn: finding.location.end.column + 1,
                    },
                },
            },
        ],
        partialFingerprints: {
            "vibeshield/v1": finding.fingerprint,
        },
        ...(finding.autofix === "SAFE" && finding.fix !== undefined
            ? {
                fixes: [
                    {
                        description: { text: finding.fix.description },
                        artifactChanges: [
                            {
                                artifactLocation: { uri: finding.fix.path, uriBaseId: "%SRCROOT%" },
                                replacements: [
                                    {
                                        deletedRegion: {
                                            startLine: finding.location.start.line,
                                            startColumn: finding.location.start.column + 1,
                                            endLine: finding.location.end.line,
                                            endColumn: finding.location.end.column + 1,
                                        },
                                        insertedContent: { text: finding.fix.replacement },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }
            : {}),
        ...(codeFlows === undefined ? {} : { codeFlows }),
        properties: {
            confidence: finding.confidence,
            reachability: finding.reachability,
            autofix: finding.autofix,
            verificationStatus: finding.verificationStatus,
            securityInvariant: finding.securityInvariant,
            evidencePathLength: finding.evidencePath?.length ?? 0,
        },
    };
}
export function toSarif(report) {
    const rules = report.coverage.enabledRuleIds
        .map((id) => RULE_BY_ID.get(id))
        .filter((rule) => rule !== undefined)
        .map(sarifRule);
    return {
        $schema: "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json",
        version: "2.1.0",
        runs: [
            {
                tool: {
                    driver: {
                        name: report.tool.name,
                        semanticVersion: report.tool.version,
                        rules,
                    },
                },
                invocations: [
                    {
                        executionSuccessful: true,
                        properties: {
                            offline: report.scan.offline,
                            filesExamined: report.manifest.filesExamined,
                            limitations: report.coverage.limitations,
                            securityIrModules: report.securityAnalysis.securityIr.modules.length,
                            authorizationProofs: report.securityAnalysis.authorizationProofs.length,
                            authenticationInvariantResults: report.securityAnalysis.authenticationAnalysis?.results.length ?? 0,
                            authenticationProvenInsecure: report.securityAnalysis.authenticationAnalysis?.metrics.provenInsecure ?? 0,
                            advisoryProviderState: report.securityAnalysis.supplyChainAnalysis?.advisories.state ?? "UNKNOWN",
                            dependencyInventoryStatus: report.securityAnalysis.supplyChainAnalysis?.inventory.status ?? "NOT_PRESENT",
                            gitHistorySecretAnalysis: report.securityAnalysis.supplyChainAnalysis?.secrets.history ?? "NOT_CHECKED",
                        },
                    },
                ],
                results: report.findings.map(sarifResult),
            },
        ],
    };
}
export function renderSarif(report) {
    return `${JSON.stringify(toSarif(report), null, 2)}\n`;
}
//# sourceMappingURL=sarif.js.map