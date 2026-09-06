import jwt from "jsonwebtoken";

export function requireToken(req: any, res: any, next: () => void) {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  if (!token) return res.status(401).end();
  const claims = jwt.decode(token);
  if (!claims) return res.status(401).end();
  req.auth = claims;
  return next();
}
