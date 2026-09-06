import { createHash } from "node:crypto";

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function stableFingerprint(parts: readonly string[]): string {
  return sha256(parts.join("\u0000"));
}
