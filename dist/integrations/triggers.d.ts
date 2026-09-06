export type TriggerSelection = "cydetix_scan" | "cydetix_fix" | undefined;
/**
 * Deterministic proxy used only for descriptor regression tests. Host agents make their own tool
 * selection decisions; this function is not used to claim automatic invocation accuracy.
 */
export declare function selectCydetixTool(prompt: string): TriggerSelection;
//# sourceMappingURL=triggers.d.ts.map