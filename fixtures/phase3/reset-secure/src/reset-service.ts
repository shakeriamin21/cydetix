import { createHash, randomBytes } from "node:crypto";
import {
  consumeReset,
  findValidReset,
  issueReset,
  revokeAllSessions,
  updatePassword,
} from "./reset-repository.js";
import { queueResetDelivery } from "./reset-delivery.js";

export async function requestReset(userId: string) {
  const resetToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(resetToken).digest("hex");
  await issueReset(userId, tokenHash, new Date(Date.now() + 900_000));
  await queueResetDelivery(userId, resetToken);
}

export async function resetPassword(tokenHash: string, passwordHash: string) {
  const reset = await findValidReset(tokenHash);
  if (!reset) return false;
  await updatePassword(reset.userId, passwordHash);
  await consumeReset(reset.id);
  await revokeAllSessions(reset.userId);
  return true;
}
