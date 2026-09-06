import { consumeReset, findUnusedReset, issueReset, replacePassword } from "./repository.js";

export async function requestPasswordReset(req: any, res: any) {
  const resetToken = Math.random().toString(36).slice(2);
  await issueReset(req.body.userId, resetToken);
  return res.status(202).json({ message: "If the account exists, recovery was queued." });
}

export async function completePasswordReset(req: any, res: any) {
  const reset = await findUnusedReset(req.body.token);
  if (!reset) return res.status(400).end();
  await replacePassword(reset.userId, req.body.passwordHash);
  await consumeReset(reset.id);
  return res.status(204).end();
}
