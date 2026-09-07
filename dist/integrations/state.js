import path from "node:path";
import { atomicValidatedWrite, readRegularFile } from "./common.js";
export function integrationStatePath(projectRoot) {
    return path.join(path.resolve(projectRoot), ".cydetix", "integration-state.json");
}
function parseState(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return undefined;
    const candidate = value;
    if (candidate.schemaVersion !== "1.0.0" ||
        !["configured", "declined", "partial"].includes(String(candidate.status)) ||
        typeof candidate.packageVersion !== "string" ||
        typeof candidate.updatedAt !== "string" ||
        typeof candidate.hosts !== "object" ||
        candidate.hosts === null ||
        Array.isArray(candidate.hosts))
        return undefined;
    return candidate;
}
export async function readIntegrationState(projectBoundary) {
    try {
        const content = await readRegularFile(projectBoundary, integrationStatePath(projectBoundary.root));
        if (content === undefined)
            return undefined;
        return parseState(JSON.parse(content));
    }
    catch {
        return undefined;
    }
}
export async function writeIntegrationState(projectBoundary, state) {
    const target = integrationStatePath(projectBoundary.root);
    const content = `${JSON.stringify(state, null, 2)}\n`;
    await atomicValidatedWrite(projectBoundary, target, content, async (writtenPath) => {
        const written = await readRegularFile(projectBoundary, writtenPath);
        if (written === undefined || parseState(JSON.parse(written)) === undefined)
            throw new Error("Cydetix integration state validation failed.");
    });
}
//# sourceMappingURL=state.js.map