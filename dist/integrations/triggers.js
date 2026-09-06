const SECURITY_CONTEXT = /\b(secur(?:e|ity)|vulnerabilit(?:y|ies)|audit|authentication|authorization|login|session|jwt|oauth|secret|leak|dependencies|dependency|supply[ -]chain|ci\/?cd|deploy|deployment|production|harden)\b/iu;
const FIX_INTENT = /\b(fix|remediate|repair|resolve)\b/iu;
const NON_SECURITY_UI = /\b(button color|pagination|sql query|rename (?:this |the )?function|css bug|responsive)\b/iu;
/**
 * Deterministic proxy used only for descriptor regression tests. Host agents make their own tool
 * selection decisions; this function is not used to claim automatic invocation accuracy.
 */
export function selectVibeShieldTool(prompt) {
    if (NON_SECURITY_UI.test(prompt) && !SECURITY_CONTEXT.test(prompt))
        return undefined;
    if (!SECURITY_CONTEXT.test(prompt))
        return undefined;
    return FIX_INTENT.test(prompt) ? "vibeshield_fix" : "vibeshield_scan";
}
//# sourceMappingURL=triggers.js.map