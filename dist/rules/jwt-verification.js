import traverse from "@babel/traverse";
import { memberName } from "../ast-analysis/babel-utils.js";
import { requireRule } from "../rule-engine/catalogue.js";
import { makeFinding, nodeRange } from "../rule-engine/finding.js";
const definition = requireRule("AS-TOKEN-001");
const AUTHORIZATION_CLAIMS = new Set([
    "role",
    "roles",
    "permission",
    "permissions",
    "scope",
    "scopes",
    "sub",
    "tenant",
    "tenantId",
    "userId",
]);
function usedInAuthorizationControlFlow(callPath) {
    const declaration = callPath.parentPath;
    if (!declaration.isVariableDeclarator() || declaration.node.id.type !== "Identifier")
        return false;
    const binding = callPath.scope.getBinding(declaration.node.id.name);
    return (binding?.referencePaths.some((reference) => {
        const parent = reference.parentPath;
        if (!parent.isMemberExpression() && !parent.isOptionalMemberExpression())
            return false;
        const claim = memberName(parent.node);
        if (claim === undefined || !AUTHORIZATION_CLAIMS.has(claim))
            return false;
        return (reference.findParent((candidate) => candidate.isIfStatement() ||
            candidate.isConditionalExpression() ||
            candidate.isSwitchStatement()) !== null);
    }) ?? false);
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function analyzeJavaScript(context) {
    if (context.parsed?.language !== "javascript" && context.parsed?.language !== "typescript")
        return [];
    if (!/(from\s+["']jsonwebtoken["']|require\(\s*["']jsonwebtoken["']\s*\))/.test(context.file.text)) {
        return [];
    }
    const findings = [];
    traverse(context.parsed.ast, {
        CallExpression(callPath) {
            if (memberName(callPath.node.callee) !== "decode")
                return;
            const range = nodeRange(callPath.node);
            if (range === undefined)
                return;
            const source = context.file.text.slice(range.start, range.end);
            if (!usedInAuthorizationControlFlow(callPath))
                return;
            findings.push(makeFinding({
                rule: definition,
                file: context.file,
                startOffset: range.start,
                endOffset: range.end,
                message: "Claims from jsonwebtoken.decode are used in authorization-sensitive control flow without signature verification.",
                affectedComponent: "JWT authentication path",
                reachability: "likely",
                fingerprintAnchor: `jsonwebtoken.decode:${source}`,
            }));
        },
    });
    return findings;
}
function analyzePython(context) {
    if (context.parsed?.language !== "python")
        return [];
    const findings = [];
    const pattern = /\b([A-Za-z_]\w*)\s*=\s*(?:jwt|pyjwt)\.decode\s*\([\s\S]{0,600}?options\s*=\s*\{[\s\S]{0,300}?["']verify_signature["']\s*:\s*False[\s\S]{0,300}?\}\s*,?\s*\)/g;
    for (const match of context.file.text.matchAll(pattern)) {
        const variable = match.at(1);
        if (variable === undefined)
            continue;
        const tail = context.file.text.slice(match.index + match[0].length, match.index + match[0].length + 600);
        const authorizationUse = new RegExp(`\\b${escapeRegExp(variable)}\\s*\\[\\s*["'](?:role|roles|permission|permissions|scope|scopes|sub|tenant|tenant_id|user_id)["']\\s*\\]`);
        if (!authorizationUse.test(tail))
            continue;
        findings.push(makeFinding({
            rule: definition,
            file: context.file,
            startOffset: match.index,
            endOffset: match.index + match[0].length,
            message: "JWT claims decoded with verify_signature=False are used in authorization-sensitive control flow.",
            affectedComponent: "JWT authentication path",
            reachability: "likely",
            fingerprintAnchor: "python-jwt-verify-signature-false",
        }));
    }
    return findings;
}
export const jwtVerificationRule = {
    definition,
    analyze(context) {
        return [...analyzeJavaScript(context), ...analyzePython(context)];
    },
};
//# sourceMappingURL=jwt-verification.js.map