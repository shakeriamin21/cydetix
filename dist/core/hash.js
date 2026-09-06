import { createHash } from "node:crypto";
export function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
}
export function stableFingerprint(parts) {
    return sha256(parts.join("\u0000"));
}
//# sourceMappingURL=hash.js.map