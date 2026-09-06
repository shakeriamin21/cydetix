import { rotateRefreshToken } from "./service.js";

export async function refresh(req: any, res: any) {
  const rotated = await rotateRefreshToken(
    req.body.refreshTokenHash,
    req.body.replacementHash,
    req.body.userId,
  );
  return rotated ? res.status(204).end() : res.status(401).end();
}
