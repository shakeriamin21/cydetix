import jwt from "jsonwebtoken";

export function requireToken(req: any, res: any, next: () => void) {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  if (!token) return res.status(401).end();
  const claims = jwt.verify(token, process.env.JWT_PUBLIC_KEY!, {
    algorithms: ["RS256"],
    issuer: "https://issuer.example",
    audience: "cydetix-fixture",
  });
  req.auth = claims;
  return next();
}
