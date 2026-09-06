export type TriggerSelection = "vibeshield_scan" | "vibeshield_fix" | undefined;
/**
 * Deterministic proxy used only for descriptor regression tests. Host agents make their own tool
 * selection decisions; this function is not used to claim automatic invocation accuracy.
 */
export declare function selectVibeShieldTool(prompt: string): TriggerSelection;
//# sourceMappingURL=triggers.d.ts.map