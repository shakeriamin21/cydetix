import {
  issueRefreshToken,
  markRefreshTokenRotated,
  revokeRefreshToken,
  validateRefreshToken,
} from "./repository.js";

export async function rotateRefreshToken(
  presentedHash: string,
  replacementHash: string,
  userId: string,
) {
  const current = await validateRefreshToken(presentedHash);
  if (!current || current.userId !== userId) return false;
  await markRefreshTokenRotated(current.id);
  await revokeRefreshToken(current.id);
  await issueRefreshToken(userId, replacementHash, new Date(Date.now() + 86_400_000));
  return true;
}
