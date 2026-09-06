import { type ScanReport } from "./schema.js";
import type { AdvisoryProvider } from "../supply-chain/advisories.js";
export interface ScanOptions {
    readonly path: string;
    readonly now?: Date;
    readonly advisories?: "offline" | "online";
    readonly advisoryProvider?: AdvisoryProvider;
    readonly history?: boolean;
}
export declare function scanRepository(options: ScanOptions): Promise<ScanReport>;
//# sourceMappingURL=engine.d.ts.map