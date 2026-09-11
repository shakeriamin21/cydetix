import { createHash } from "node:crypto";
export function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
}
export function stableFingerprint(parts) {
    return sha256(parts.join("\u0000"));
}
function canonicalize(value) {
    if (Array.isArray(value))
        return value.map((item) => canonicalize(item));
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, canonicalize(item)]));
    }
    return value;
}
export function stableJson(value) {
    return JSON.stringify(canonicalize(value));
}
export function stableObjectFingerprint(value) {
    return sha256(stableJson(value));
}
//# sourceMappingURL=hash.js.map