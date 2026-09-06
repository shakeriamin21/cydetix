import type { SourceFile } from "../repository-discovery/traverse.js";
import { type AdvisoryOptions } from "./advisories.js";
import { type WorkflowSignal } from "./github-actions.js";
import { type SupplyChainAnalysis } from "./model.js";
export interface SupplyChainOptions {
    readonly root: string;
    readonly advisoryMode?: AdvisoryOptions["mode"];
    readonly advisoryProvider?: AdvisoryOptions["provider"];
    readonly history?: boolean;
    readonly now?: Date;
}
export interface SupplyChainBuildResult {
    readonly analysis: SupplyChainAnalysis;
    readonly workflowSignals: readonly WorkflowSignal[];
}
export declare function buildSupplyChainAnalysis(files: readonly SourceFile[], options: SupplyChainOptions): Promise<SupplyChainBuildResult>;
//# sourceMappingURL=engine.d.ts.map