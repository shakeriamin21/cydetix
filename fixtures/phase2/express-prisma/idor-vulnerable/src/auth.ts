import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const claims = jwt.verify(req.headers.authorization, process.env.JWT_SECRET);
  req.auth = { userId: claims.sub };
  next();
}
