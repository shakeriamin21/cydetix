import { sha256, stableFingerprint } from "../core/hash.js";
export function pointAt(text, offset) {
    const safeOffset = Math.max(0, Math.min(offset, text.length));
    const prefix = text.slice(0, safeOffset);
    const lines = prefix.split("\n");
    return {
        line: lines.length,
        column: lines.at(-1)?.length ?? 0,
        offset: safeOffset,
    };
}
export function lineExcerpt(text, offset) {
    const start = text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
    const lineEnd = text.indexOf("\n", offset);
    return (text
        .slice(start, lineEnd === -1 ? text.length : lineEnd)
        .trim()
        .slice(0, 240) || "(empty line)");
}
export function nodeRange(node) {
    if (typeof node.start !== "number" || typeof node.end !== "number")
        return undefined;
    return { start: node.start, end: node.end };
}
export function makeFix(file, startOffset, endOffset, replacement, description) {
    return {
        path: file.relativePath,
        startOffset,
        endOffset,
        expectedTextSha256: sha256(file.text.slice(startOffset, endOffset)),
        replacement,
        description,
    };
}
export function makeFinding(input) {
    const excerpt = input.excerpt ?? lineExcerpt(input.file.text, input.startOffset);
    const fingerprintAnchor = input.fingerprintAnchor ?? excerpt.replaceAll(/\s+/g, " ").trim();
    return {
        fingerprint: stableFingerprint([input.rule.id, input.file.relativePath, fingerprintAnchor]),
        ruleId: input.rule.id,
        ruleVersion: input.rule.version,
        severity: input.rule.severity,
        confidence: input.rule.confidence,
        reachability: input.reachability ?? "possible",
        title: input.rule.title,
        category: input.rule.category,
        affectedComponent: input.affectedComponent ?? input.file.relativePath,
        location: {
            path: input.file.relativePath,
            start: pointAt(input.file.text, input.startOffset),
            end: pointAt(input.file.text, input.endOffset),
        },
        evidence: [
            {
                message: input.message,
                excerpt,
                redacted: input.redacted ?? false,
            },
        ],
        ...(input.evidencePath === undefined ? {} : { evidencePath: [...input.evidencePath] }),
        securityInvariant: input.rule.securityInvariant,
        attackPrerequisite: input.rule.attackPrerequisite,
        impact: input.rule.impact,
        standards: input.rule.standards,
        remediation: input.rule.remediation,
        autofix: input.autofix ?? input.rule.autofix,
        ...(input.fix === undefined ? {} : { fix: input.fix }),
        verificationStatus: "not_attempted",
    };
}
//# sourceMappingURL=finding.js.map