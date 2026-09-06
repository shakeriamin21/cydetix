import type { ScanReport } from "../core/schema.js";
export interface SarifLog {
    readonly $schema: "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json";
    readonly version: "2.1.0";
    readonly runs: readonly unknown[];
}
export declare function toSarif(report: ScanReport): SarifLog;
export declare function renderSarif(report: ScanReport): string;
//# sourceMappingURL=sarif.d.ts.map