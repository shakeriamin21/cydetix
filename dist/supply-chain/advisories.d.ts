import { type AdvisoryAnalysis, type NormalizedAdvisory, type PackageComponent } from "./model.js";
export interface AdvisoryProvider {
    readonly name: string;
    readonly endpoint: string;
    query(packages: readonly PackageComponent[]): Promise<readonly NormalizedAdvisory[]>;
}
export interface AdvisoryOptions {
    readonly mode: "offline" | "online";
    readonly provider?: AdvisoryProvider;
    readonly now?: Date;
}
type FetchLike = typeof fetch;
export declare class OsvAdvisoryProvider implements AdvisoryProvider {
    private readonly fetchImplementation;
    private readonly timeoutMilliseconds;
    readonly name = "OSV";
    readonly endpoint = "https://api.osv.dev/v1/querybatch";
    constructor(fetchImplementation?: FetchLike, timeoutMilliseconds?: number);
    query(packages: readonly PackageComponent[]): Promise<readonly NormalizedAdvisory[]>;
}
export declare function analyzeAdvisories(packages: readonly PackageComponent[], options: AdvisoryOptions): Promise<AdvisoryAnalysis>;
export {};
//# sourceMappingURL=advisories.d.ts.map