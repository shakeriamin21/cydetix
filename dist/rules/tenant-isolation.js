import { requireRule } from "../rule-engine/catalogue.js";
import { makeFinding } from "../rule-engine/finding.js";
const definition = requireRule("AS-TENANT-001");
export const tenantIsolationRule = {
    definition,
    analyze(context) {
        const filesByPath = new Map(context.files.map((file) => [file.relativePath, file]));
        const findings = [];
        for (const proof of context.authorizationProofs) {
            if (proof.invariant !== "tenant-isolation" || proof.state !== "VIOLATED")
                continue;
            const resourceStep = [...proof.evidencePath]
                .reverse()
                .find((item) => item.kind === "resource");
            if (resourceStep === undefined)
                continue;
            const file = filesByPath.get(resourceStep.location.path);
            if (file === undefined)
                continue;
            findings.push(makeFinding({
                rule: definition,
                file,
                startOffset: resourceStep.location.start.offset,
                endOffset: resourceStep.location.end.offset,
                message: proof.explanation,
                affectedComponent: "cross-file tenant isolation path",
                reachability: proof.reachability,
                evidencePath: proof.evidencePath,
                fingerprintAnchor: proof.id,
            }));
        }
        return findings;
    },
};
//# sourceMappingURL=tenant-isolation.js.map