import { type CydetixConfig } from "../core/schema.js";
import type { RepositoryBoundary } from "./boundary.js";
export declare const CONFIG_NAME = ".cydetix.json";
export declare const DEFAULT_CONFIG: CydetixConfig;
export declare function loadConfig(boundary: RepositoryBoundary): Promise<CydetixConfig>;
//# sourceMappingURL=config.d.ts.map