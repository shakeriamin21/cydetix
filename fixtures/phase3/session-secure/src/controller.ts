import { verifyCredentials } from "./auth.js";

export async function login(req: any, res: any) {
  const user = await verifyCredentials(req.body.email, req.body.password);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error: Error | undefined) => (error ? reject(error) : resolve()));
  });
  req.session.userId = user.id;
  return res.status(204).end();
}

export function requireSession(req: any, res: any, next: () => void) {
  if (!req.session.userId) return res.status(401).end();
  return next();
}

export function protectedResource(req: any, res: any) {
  return res.json({ subject: req.session.userId });
}

export async function logout(req: any, res: any) {
  await new Promise<void>((resolve, reject) => {
    req.session.destroy((error: Error | undefined) => (error ? reject(error) : resolve()));
  });
  res.clearCookie("sid");
  return res.status(204).end();
}
