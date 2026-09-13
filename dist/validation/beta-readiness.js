import { z } from "zod";
const count = z.number().int().nonnegative();
const sha = z.string().regex(/^[a-f0-9]{40}$/u);
export const readinessGateSchema = z
    .object({
    id: z.string().min(1),
    state: z.enum(["PASSED", "FAILED", "NOT_RUN", "BLOCKED", "NOT_AVAILABLE"]),
    evidence: z.string().min(1),
    sourceCommit: sha.optional(),
})
    .strict();
export const betaReadinessSchema = z
    .object({
    schemaVersion: z.literal("1.0.0"),
    sourceCommit: sha,
    sourceBinding: z.string().min(1),
    version: z.literal("0.6.0-alpha.12"),
    baselineCommit: z.literal("4e13b96cc3539e1b623a4c5a12f10a0954776253"),
    baselineTagObject: z.literal("e692f1e23d58157a209f511adb6180d3f489a80c"),
    tests: z
        .object({
        total: count,
        passed: count,
        failed: count,
        skipped: count,
        sandboxPassed: count,
        sandboxSkipped: count,
        evidence: z.string().min(1),
    })
        .strict(),
    corpus: z
        .object({
        groundTruth: z.literal("INCOMPLETE"),
        recall: z.null(),
        accuracy: z.null(),
        identities: z.array(z
            .object({
            repository: z.string().min(1),
            commit: sha,
            scansCompleted: count,
            determinism: z.enum(["PASSED", "FAILED", "NOT_ESTABLISHED"]),
            evidence: z.string().min(1),
        })
            .strict()),
        confirmedFP: count,
        supportedPatternFN: count,
        adjudicationScope: z.string().min(1),
        unadjudicatedFindings: count,
        fpEvidence: z.array(z.string()),
        fnEvidence: z.array(z.string()),
        unknown: z
            .object({
            applicationDataflow: count,
            authorization: count,
            authentication: count,
            findingProof: count,
            majorCauses: z.array(z.string()),
            limitation: z.string().min(1),
        })
            .strict(),
    })
        .strict(),
    performance: z
        .object({
        state: z.enum(["PASSED", "FAILED", "NOT_RUN", "INCONCLUSIVE"]),
        evidence: z.string().min(1),
        measurements: z.array(z
            .object({
            target: z.string(),
            size: z.enum(["small", "medium", "large"]),
            samplesPerVersion: count,
            baselineP50Milliseconds: z.number().nonnegative().nullable(),
            candidateP50Milliseconds: z.number().nonnegative().nullable(),
            baselineP95Milliseconds: z.number().nonnegative().nullable(),
            candidateP95Milliseconds: z.number().nonnegative().nullable(),
            semanticEquivalence: z.enum(["PASSED", "FAILED", "NOT_ESTABLISHED"]),
        })
            .strict()),
        limitations: z.array(z.string()),
    })
        .strict(),
    integrations: z.array(z
        .object({
        agent: z.string().min(1),
        configuration: readinessGateSchema.shape.state,
        adapterTests: readinessGateSchema.shape.state,
        subprocess: readinessGateSchema.shape.state,
        liveHost: readinessGateSchema.shape.state,
        evidence: z.string().min(1),
    })
        .strict()),
    publicContracts: z
        .object({
        state: readinessGateSchema.shape.state,
        evidence: z.string().min(1),
        intentionalChanges: z.array(z.string()),
    })
        .strict(),
    supplyChainGates: z.array(readinessGateSchema),
    remediationAuthority: z.literal("UNCHANGED_EXACT_HTTPONLY_SAFE_ONLY"),
    blockers: z.array(z.string().min(1)),
    verdict: z.enum(["ALPHA12_NOT_BETA_READY", "ALPHA12_BETA_READY_WITH_LIMITATIONS"]),
})
    .strict();
/** Cross-field gates supplement the portable JSON Schema. Missing evidence never passes. */
export function validateBetaReadiness(value) {
    const report = betaReadinessSchema.parse(value);
    if (report.tests.total !== report.tests.passed + report.tests.failed + report.tests.skipped)
        throw new Error("Test accounting is inconsistent.");
    if (new Set(report.corpus.identities.map((item) => item.repository)).size !==
        report.corpus.identities.length)
        throw new Error("Duplicate corpus identity.");
    if (new Set(report.supplyChainGates.map((item) => item.id)).size !== report.supplyChainGates.length)
        throw new Error("Duplicate supply-chain gate.");
    if (new Set(report.integrations.map((item) => item.agent)).size !== report.integrations.length)
        throw new Error("Duplicate integration identity.");
    if (report.tests.sandboxPassed > report.tests.passed ||
        report.tests.sandboxSkipped > report.tests.skipped)
        throw new Error("Sandbox accounting is inconsistent.");
    if (report.verdict === "ALPHA12_BETA_READY_WITH_LIMITATIONS") {
        const required = [
            "lockedInstallation",
            "npmAudit",
            "onlineOsv",
            "cycloneDx",
            "sarif",
            "licenses",
            "privacy",
            "history",
            "gitleaks",
            "workflowSecurity",
            "package",
            "packedInstall",
            "selfScan",
            "mandatorySandbox",
            "hostedCi",
            "codeql",
            "openssf",
            "releaseControls",
        ];
        if (report.blockers.length ||
            report.tests.total < 374 ||
            report.tests.failed ||
            report.tests.skipped ||
            report.tests.sandboxPassed < 13 ||
            report.tests.sandboxSkipped ||
            report.corpus.identities.length < 22 ||
            report.corpus.identities.some((item) => item.scansCompleted < 2 || item.determinism !== "PASSED") ||
            report.corpus.supportedPatternFN ||
            report.corpus.confirmedFP ||
            report.corpus.unadjudicatedFindings ||
            report.performance.state !== "PASSED" ||
            report.publicContracts.state !== "PASSED" ||
            required.some((id) => !report.supplyChainGates.some((gate) => gate.id === id && gate.state === "PASSED")))
            throw new Error("Positive beta verdict lacks complete passing evidence.");
        for (const size of ["small", "medium", "large"])
            if (!report.performance.measurements.some((item) => item.size === size &&
                item.samplesPerVersion >= 20 &&
                item.baselineP50Milliseconds !== null &&
                item.candidateP50Milliseconds !== null &&
                item.baselineP95Milliseconds !== null &&
                item.candidateP95Milliseconds !== null &&
                item.semanticEquivalence === "PASSED"))
                throw new Error("Positive beta verdict lacks representative performance evidence.");
        for (const agent of [
            "codex",
            "claude",
            "cursor",
            "gemini",
            "cline",
            "roo",
            "continue",
            "copilot",
            "goose",
            "windsurf",
            "generic-mcp",
        ])
            if (!report.integrations.some((item) => item.agent === agent &&
                item.configuration === "PASSED" &&
                item.adapterTests === "PASSED" &&
                item.subprocess === "PASSED"))
                throw new Error("Positive beta verdict lacks integration evidence.");
    }
    return report;
}
//# sourceMappingURL=beta-readiness.js.map