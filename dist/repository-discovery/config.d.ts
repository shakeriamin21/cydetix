import { type InvariantSecConfig } from "../core/schema.js";
import type { RepositoryBoundary } from "./boundary.js";
export declare const CONFIG_NAME = ".vibeshield.json";
export declare const LEGACY_CONFIG_NAME = ".invariantsec.json";
export declare const DEFAULT_CONFIG: InvariantSecConfig;
export declare function loadConfig(boundary: RepositoryBoundary): Promise<InvariantSecConfig>;
//# sourceMappingURL=config.d.ts.map