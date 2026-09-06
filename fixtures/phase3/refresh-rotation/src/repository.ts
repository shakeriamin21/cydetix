import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function issueRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
  return prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
}

export function validateRefreshToken(tokenHash: string) {
  return prisma.refreshToken.findFirst({
    where: { tokenHash, expiresAt: { gt: new Date() }, revokedAt: null },
  });
}

export function markRefreshTokenRotated(id: string) {
  return prisma.refreshToken.update({ where: { id }, data: { rotatedAt: new Date() } });
}

export function revokeRefreshToken(id: string) {
  return prisma.refreshToken.delete({ where: { id } });
}
