import type { SourceFile } from "../repository-discovery/traverse.js";
import type { IrLocation } from "../security-ir/model.js";
/** Preserve the original UTF-16/LF coordinate contract without splitting every source prefix. */
export declare function sourcePoint(file: Pick<SourceFile, "text">, offset: number): IrLocation["start"];
//# sourceMappingURL=source-location.d.ts.map