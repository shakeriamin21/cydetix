import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { configSchema } from "../core/schema.js";
import { InvariantSecError, EXIT } from "../core/errors.js";
export const CONFIG_NAME = ".vibeshield.json";
export const LEGACY_CONFIG_NAME = ".invariantsec.json";
const MAX_CONFIG_BYTES = 65_536;
function errorCode(error) {
    if (typeof error !== "object" || error === null || !("code" in error))
        return undefined;
    return typeof error.code === "string" ? error.code : undefined;
}
export const DEFAULT_CONFIG = configSchema.parse({
    schemaVersion: "1.0.0",
});
export async function loadConfig(boundary) {
    const candidates = [CONFIG_NAME, LEGACY_CONFIG_NAME];
    let selectedName;
    let selectedStat;
    for (const candidate of candidates) {
        const candidatePath = path.join(boundary.root, candidate);
        const candidateStat = await lstat(candidatePath).catch((error) => {
            if (errorCode(error) === "ENOENT")
                return undefined;
            throw error;
        });
        if (candidateStat !== undefined) {
            selectedName = candidate;
            selectedStat = candidateStat;
            break;
        }
    }
    if (selectedName === undefined || selectedStat === undefined)
        return DEFAULT_CONFIG;
    const configPath = path.join(boundary.root, selectedName);
    if (selectedStat.isSymbolicLink() ||
        !selectedStat.isFile() ||
        selectedStat.size > MAX_CONFIG_BYTES) {
        throw new InvariantSecError(`${selectedName} must be a regular file smaller than ${MAX_CONFIG_BYTES} bytes.`, EXIT.usage);
    }
    try {
        const parsed = JSON.parse(await readFile(configPath, "utf8"));
        return configSchema.parse(parsed);
    }
    catch (error) {
        throw new InvariantSecError(`Invalid ${selectedName}; repository content was not echoed.`, EXIT.usage, {
            cause: error,
        });
    }
}
//# sourceMappingURL=config.js.map