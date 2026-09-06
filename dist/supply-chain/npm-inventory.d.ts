import type { SourceFile } from "../repository-discovery/traverse.js";
import { type DependencyInventory, type SupplyChainEvidence } from "./model.js";
export interface InventoryBuildResult {
    readonly inventory: DependencyInventory;
    readonly evidence: readonly SupplyChainEvidence[];
}
export declare function npmPurl(name: string, version: string): string;
export declare function buildNpmDependencyInventory(files: readonly SourceFile[]): InventoryBuildResult;
//# sourceMappingURL=npm-inventory.d.ts.map