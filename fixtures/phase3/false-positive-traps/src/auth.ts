import jwt from "jsonwebtoken";

function verifyToken(token: string) {
  return jwt.verify(token, process.env.JWT_PUBLIC_KEY!, {
    algorithms: ["RS256"],
    issuer: "https://issuer.example",
    audience: "invariantsec-fixture",
  });
}

export function requireToken(req: any, res: any, next: () => void) {
  const raw = req.headers.authorization?.replace(/^Bearer /, "");
  if (!raw) return res.status(401).end();
  req.auth = verifyToken(raw);
  return next();
}
