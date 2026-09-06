import { performance } from "node:perf_hooks";
import { stableFingerprint } from "../core/hash.js";
import { analyzeAdvisories } from "./advisories.js";
import { analyzeGithubActions } from "./github-actions.js";
import { scanGitHistory } from "./history.js";
import { supplyChainAnalysisSchema, supplyChainEvidenceSchema, } from "./model.js";
import { buildNpmDependencyInventory } from "./npm-inventory.js";
import { generateCycloneDxSbom } from "./sbom.js";
import { analyzeWorkingTreeSecrets } from "./secrets.js";
function secretEvidence(exposures) {
    return exposures.map((exposure) => supplyChainEvidenceSchema.parse({
        id: `supply-evidence:${stableFingerprint(["secret", exposure.id, exposure.engine]).slice(0, 16)}`,
        kind: exposure.sourceCategory === "git-history" ? "history" : "secret-exposure",
        location: exposure.location,
        message: exposure.sourceCategory === "git-history"
            ? `Historical ${exposure.provider} credential exposure detected by ${exposure.engine}.`
            : `${exposure.provider} credential exposure detected in the working tree.`,
        redacted: true,
    }));
}
export async function buildSupplyChainAnalysis(files, options) {
    const dependencyStart = performance.now();
    const inventoryResult = buildNpmDependencyInventory(files);
    const dependencyParsing = performance.now() - dependencyStart;
    const advisoryStart = performance.now();
    const advisories = await analyzeAdvisories(inventoryResult.inventory.packages, {
        mode: options.advisoryMode ?? "offline",
        ...(options.advisoryProvider === undefined ? {} : { provider: options.advisoryProvider }),
        ...(options.now === undefined ? {} : { now: options.now }),
    });
    const advisoryProcessing = performance.now() - advisoryStart;
    const secretStart = performance.now();
    const workingTreeSecrets = analyzeWorkingTreeSecrets(files);
    const secretScan = performance.now() - secretStart;
    const historyStart = performance.now();
    const history = options.history === true ? scanGitHistory(options.root) : undefined;
    const historyScan = performance.now() - historyStart;
    const historicalExposures = history?.exposures ?? [];
    const exposures = [
        ...new Map([...workingTreeSecrets.exposures, ...historicalExposures].map((exposure) => [
            `${exposure.sourceCategory}:${exposure.location.path}:${exposure.fingerprint}:${exposure.engine}`,
            exposure,
        ])).values(),
    ];
    const secrets = {
        ...workingTreeSecrets,
        history: history?.state ?? "NOT_CHECKED",
        exposures,
        limitations: [
            ...workingTreeSecrets.limitations,
            ...(history === undefined
                ? ["Git history was not checked; use the explicit history mode."]
                : [history.message]),
        ],
    };
    const workflowStart = performance.now();
    const workflows = analyzeGithubActions(files);
    const workflowAnalysis = performance.now() - workflowStart;
    const sbomStart = performance.now();
    generateCycloneDxSbom(inventoryResult.inventory, options.now ?? new Date());
    const sbomGeneration = performance.now() - sbomStart;
    const allActionPinsSecure = workflows.analysis.actionReferences.length > 0 &&
        workflows.analysis.actionReferences.every((reference) => ["full-sha", "local", "digest"].includes(reference.pinning));
    const hasWriteAll = workflows.analysis.permissions.some((permission) => permission.access === "write-all");
    const workflowText = files
        .filter((file) => workflows.analysis.workflows.includes(file.relativePath))
        .map((file) => file.text)
        .join("\n");
    const combinedEvidence = [
        ...inventoryResult.evidence,
        ...workflows.evidence,
        ...secretEvidence(exposures),
    ];
    const analysis = supplyChainAnalysisSchema.parse({
        schemaVersion: "1.0.0",
        inventory: inventoryResult.inventory,
        advisories,
        secrets,
        ci: workflows.analysis,
        controls: {
            sourceIntegrity: workflows.analysis.actionReferences.length === 0
                ? "UNKNOWN"
                : allActionPinsSecure
                    ? "PROVEN"
                    : "PARTIAL",
            buildProvenance: workflows.analysis.provenanceWorkflows.length > 0 ? "PARTIAL" : "NOT_PRESENT",
            artifactIdentity: /sha256sum|Get-FileHash|shasum\s+-a\s+256/iu.test(workflowText)
                ? "PROVEN"
                : "UNKNOWN",
            signing: /\b(?:cosign|sigstore)\b/iu.test(workflowText) ? "PARTIAL" : "NOT_PRESENT",
            dependencyInventory: inventoryResult.inventory.status === "COMPLETE"
                ? "PROVEN"
                : inventoryResult.inventory.status === "NOT_PRESENT"
                    ? "NOT_PRESENT"
                    : "PARTIAL",
            ciPermissions: workflows.analysis.workflows.length === 0
                ? "NOT_PRESENT"
                : workflows.analysis.permissions.length === 0
                    ? "UNKNOWN"
                    : hasWriteAll
                        ? "PARTIAL"
                        : "PROVEN",
        },
        ir: {
            schemaVersion: "1.0.0",
            packages: inventoryResult.inventory.packages,
            workflows: workflows.analysis.workflows,
            actions: workflows.analysis.actionReferences,
            secrets: exposures,
            evidence: combinedEvidence,
            edges: inventoryResult.inventory.edges,
            limitations: [
                ...inventoryResult.inventory.limitations,
                ...workflows.analysis.limitations,
                "Provenance controls report observable repository evidence only; no SLSA level is inferred.",
            ],
        },
        performanceMilliseconds: {
            dependencyParsing,
            advisoryProcessing,
            secretScan,
            historyScan,
            workflowAnalysis,
            sbomGeneration,
        },
    });
    return { analysis, workflowSignals: workflows.signals };
}
//# sourceMappingURL=engine.js.map