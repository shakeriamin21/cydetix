const SECURITY_CONTEXT = /\b(secur(?:e|ity)|vulnerabilit(?:y|ies)|audit|authentication|authorization|login|session|jwt|oauth|secret|leak(?:ed|s|age)?|dependencies|dependency|supply[ -]chain|ci\/?cd|deploy|deployment|production|harden)\b/iu;
const FIX_INTENT = /\b(fix|remediate|repair|resolve)\b/iu;
const SECURITY_SAFETY_QUESTION = /\b(?:safe to (?:deploy|ship|release)|(?:is|are)\b.{0,80}\b(?:app|api|project|software|login|authentication|oauth|jwt|dependencies)\b.{0,40}\bsafe|fix (?:what|whatever|anything)\b.{0,60}\bsafe(?:ly)?)\b/iu;
const NON_SECURITY_UI = /\b(button color|pagination|sql query|rename (?:this |the )?function|css bug|responsive)\b/iu;
/**
 * Deterministic proxy used only for descriptor regression tests. Host agents make their own tool
 * selection decisions; this function is not used to claim automatic invocation accuracy.
 */
export function selectCydetixTool(prompt) {
    const securityRelevant = SECURITY_CONTEXT.test(prompt) || SECURITY_SAFETY_QUESTION.test(prompt);
    if (NON_SECURITY_UI.test(prompt) && !securityRelevant)
        return undefined;
    if (!securityRelevant)
        return undefined;
    return FIX_INTENT.test(prompt) ? "cydetix_fix" : "cydetix_scan";
}
//# sourceMappingURL=triggers.js.map