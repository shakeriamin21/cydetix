import type { PersistentRuntime } from "./types.js";
export declare const PERSISTENT_RUNTIME_REQUIRED = "AI integration requires a persistent local Cydetix installation. Run \"npm install -g cydetix\", then rerun \"cydetix setup\". The normal \"npx cydetix\" scanner remains available.";
export declare function isEphemeralNpxPath(candidate: string): boolean;
export declare function verifyPersistentRuntime(options: {
    readonly packageRoot: string;
    readonly projectRoot: string;
    readonly expectedVersion: string;
    readonly nodeExecutable?: string;
}): Promise<PersistentRuntime>;
export declare function resolvePersistentRuntime(options: {
    readonly projectRoot: string;
    readonly expectedVersion: string;
}): Promise<PersistentRuntime>;
//# sourceMappingURL=runtime.d.ts.map