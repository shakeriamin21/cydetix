export function requireSession(req: any, res: any, next: () => void) {
  if (!req.session.userId) return res.status(401).end();
  return next();
}

export function protectedResource(req: any, res: any) {
  return res.json({ subject: req.session.userId });
}

export function logout(_req: any, res: any) {
  res.clearCookie("sid");
  return res.status(204).end();
}
