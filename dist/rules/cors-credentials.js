import traverse from "@babel/traverse";
import { asObject, objectProperty, propertyExpression } from "../ast-analysis/babel-utils.js";
import { requireRule } from "../rule-engine/catalogue.js";
import { makeFinding, nodeRange } from "../rule-engine/finding.js";
const definition = requireRule("AS-CORS-001");
function insecureCorsOptions(options) {
    const origin = propertyExpression(objectProperty(options, "origin"));
    const credentials = propertyExpression(objectProperty(options, "credentials"));
    return (origin?.type === "BooleanLiteral" &&
        origin.value &&
        credentials?.type === "BooleanLiteral" &&
        credentials.value);
}
function analyzeJavaScript(context) {
    if (context.parsed?.language !== "javascript" && context.parsed?.language !== "typescript")
        return [];
    const findings = [];
    traverse(context.parsed.ast, {
        CallExpression(callPath) {
            if (callPath.node.callee.type !== "Identifier" || callPath.node.callee.name !== "cors")
                return;
            const options = asObject(callPath.node.arguments[0]);
            const range = options === undefined ? undefined : nodeRange(options);
            if (options === undefined || range === undefined || !insecureCorsOptions(options))
                return;
            findings.push(makeFinding({
                rule: definition,
                file: context.file,
                startOffset: range.start,
                endOffset: range.end,
                message: "CORS enables credentials while origin=true reflects and trusts every request origin.",
                affectedComponent: "CORS middleware",
                reachability: "possible",
                fingerprintAnchor: `cors:${context.file.text.slice(range.start, range.end)}`,
            }));
        },
    });
    return findings;
}
function analyzePython(context) {
    if (context.parsed?.language !== "python")
        return [];
    const findings = [];
    const pattern = /\bCORS\s*\([\s\S]{0,500}?supports_credentials\s*=\s*True[\s\S]{0,500}?(?:origins\s*=\s*["']\*["']|resources\s*=\s*\{\s*["']\*["'])[^)]*\)/g;
    for (const match of context.file.text.matchAll(pattern)) {
        findings.push(makeFinding({
            rule: definition,
            file: context.file,
            startOffset: match.index,
            endOffset: match.index + match[0].length,
            message: "Flask-CORS enables credentials for a wildcard origin/resource.",
            affectedComponent: "CORS middleware",
            reachability: "possible",
            fingerprintAnchor: "python-cors-wildcard-credentials",
        }));
    }
    return findings;
}
export const corsCredentialsRule = {
    definition,
    analyze(context) {
        return [...analyzeJavaScript(context), ...analyzePython(context)];
    },
};
//# sourceMappingURL=cors-credentials.js.map