import type { SourceFile } from "../repository-discovery/traverse.js";
import type { IrLocation, SecurityIr } from "../security-ir/model.js";
export interface ExpressAuthenticationProof {
    readonly routeId: string;
    readonly handlerSymbolId: string;
    readonly middlewareSymbolId: string;
    readonly requestParameterName: string;
    readonly location: IrLocation;
    readonly message: string;
}
export declare function analyzeExpressAuthentication(ir: SecurityIr, files: readonly SourceFile[]): ExpressAuthenticationProof[];
//# sourceMappingURL=express.d.ts.map