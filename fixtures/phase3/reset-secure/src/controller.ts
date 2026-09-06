import { requestReset, resetPassword } from "./reset-service.js";
import { createSession, lookupSession } from "./session-repository.js";

export async function requestPasswordReset(req: any, res: any) {
  await requestReset(req.body.userId);
  return res
    .status(202)
    .json({ message: "If the account exists, recovery instructions were sent." });
}

export async function completePasswordReset(req: any, res: any) {
  const changed = await resetPassword(req.body.tokenHash, req.body.passwordHash);
  return res.status(changed ? 204 : 400).end();
}

export async function establishSession(req: any, res: any) {
  await createSession(req.body.userId, req.body.sessionId);
  return res.status(204).end();
}

export async function protectedResource(req: any, res: any) {
  const session = await lookupSession(req.headers.authorization);
  return session ? res.json({ subject: session.userId }) : res.status(401).end();
}
