import { externalSessions } from "external-session-provider";
import { consumeReset, findReset, updatePassword } from "./repository.js";

export async function completePasswordReset(req: any, res: any) {
  const reset = await findReset(req.body.tokenHash);
  if (!reset) return res.status(400).end();
  await updatePassword(reset.userId, req.body.passwordHash);
  await consumeReset(reset.id);
  await externalSessions.applyPasswordResetPolicy(reset.userId);
  return res.status(204).end();
}
