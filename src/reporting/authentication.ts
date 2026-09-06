import type { ScanReport } from "../core/schema.js";
import { terminalSafe } from "./terminal.js";
import { renderFinding } from "./text.js";

function protocolLabel(protocol: string): string {
  return protocol
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function renderAuthenticationText(report: ScanReport): string {
  const analysis = report.securityAnalysis.authenticationAnalysis;
  if (analysis === undefined) {
    return `${report.tool.name} ${report.tool.version}\nTarget: ${terminalSafe(report.manifest.root)}\n\nAuthentication protocol analysis is unavailable in this report.\n`;
  }
  const protocols = [...new Set(analysis.operations.map((operation) => operation.protocol))].sort();
  const applicableUnknown = analysis.results.filter(
    (result) => result.applicability === "APPLICABLE" && result.conclusion === "UNKNOWN",
  );
  const applicabilityUnknown = analysis.results.filter(
    (result) => result.applicability === "UNKNOWN",
  );
  const lines = [
    `${terminalSafe(report.tool.name)} ${terminalSafe(report.tool.version)}`,
    `Target: ${terminalSafe(report.manifest.root)}`,
    "",
    "AUTHENTICATION ARCHITECTURE",
    `  Mechanisms: ${protocols.map(protocolLabel).join(", ") || "none detected"}`,
  ];
  for (const protocol of protocols) {
    const operations = analysis.operations.filter((operation) => operation.protocol === protocol);
    const kinds = [...new Set(operations.map((operation) => operation.kind))].sort();
    lines.push(
      `  ${protocolLabel(protocol)}: ${operations.length} evidence-backed operation(s)`,
      `    ${kinds.map(terminalSafe).join(" -> ")}`,
    );
  }
  lines.push(
    "",
    "SECURITY INVARIANTS",
    `  Proven secure: ${analysis.metrics.provenSecure}`,
    `  Proven insecure: ${analysis.metrics.provenInsecure}`,
    `  Applicable but unknown: ${analysis.metrics.unknown}`,
    `  Applicability unknown: ${applicabilityUnknown.length}`,
    `  Not applicable: ${analysis.metrics.notApplicable}`,
    `  Evidence steps: ${analysis.metrics.evidenceSteps}`,
  );
  for (const result of analysis.results.filter(
    (candidate) => candidate.applicability !== "NOT_APPLICABLE",
  )) {
    lines.push(
      `  ${result.conclusion}  ${terminalSafe(result.invariantId)}`,
      `    Applicability: ${result.applicability}  Confidence: ${result.confidence}`,
      `    Evidence: ${result.evidencePath.length} step(s) across ${new Set(result.evidencePath.map((step) => step.location.path)).size} file(s)`,
      `    ${terminalSafe(result.explanation)}`,
    );
  }
  if (applicableUnknown.length > 0 || applicabilityUnknown.length > 0) {
    lines.push("", "UNKNOWN / COVERAGE LIMITATIONS");
    for (const result of [...applicableUnknown, ...applicabilityUnknown]) {
      lines.push(
        `  ${terminalSafe(result.invariantId)}: ${terminalSafe(result.unresolvedConditions.join("; ") || result.explanation)}`,
      );
    }
  }
  lines.push("", "FINDINGS");
  if (report.findings.length === 0) {
    lines.push("  No failed authentication invariant produced an active finding.");
  } else {
    lines.push(...report.findings.flatMap((finding) => [renderFinding(finding), ""]));
  }
  lines.push(
    "COVERAGE",
    ...analysis.limitations.map((limitation) => `  - ${terminalSafe(limitation)}`),
  );
  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderAuthenticationGraphText(report: ScanReport): string {
  const lines = [
    `AUTHENTICATION GRAPH ${report.securityAnalysis.authenticationAnalysis?.graphVersion ?? "unavailable"}`,
    `Nodes: ${report.authGraph.nodes.length}`,
  ];
  for (const node of report.authGraph.nodes) {
    const source = node.sourceEvidence?.[0];
    lines.push(
      `  ${terminalSafe(node.id)}  ${terminalSafe(node.kind)}  ${terminalSafe(node.label)}`,
      source === undefined
        ? "    Source: unavailable"
        : `    Source: ${terminalSafe(source.location.path)}:${source.location.start.line}:${source.location.start.column + 1} - ${terminalSafe(source.message)}`,
    );
  }
  lines.push(`Edges: ${report.authGraph.edges.length}`);
  for (const edge of report.authGraph.edges) {
    lines.push(
      `  ${terminalSafe(edge.from)} --${terminalSafe(edge.relation)}--> ${terminalSafe(edge.to)}`,
      `    ${terminalSafe(edge.evidence)}`,
    );
  }
  const unknownEdges = report.authGraph.edges.filter((edge) => edge.relation === "unknown").length;
  lines.push(`Unknown edges: ${unknownEdges}`);
  return `${lines.join("\n")}\n`;
}
