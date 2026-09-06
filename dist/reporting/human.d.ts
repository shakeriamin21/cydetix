import type { Finding, ScanReport } from "../core/schema.js";
import type { RemediationReport } from "../remediation/model.js";
export type DecisionCategory = "FIX NOW" | "REVIEW" | "UNKNOWN";
export declare function decisionCategory(finding: Finding): DecisionCategory;
export declare function renderHuman(report: ScanReport): string;
export declare function renderRemediationHuman(report: RemediationReport): string;
//# sourceMappingURL=human.d.ts.map