import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function issueReset(userId: string, tokenHash: string, expiresAt: Date) {
  return prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt, usedAt: null } });
}

export function findValidReset(tokenHash: string) {
  return prisma.passwordResetToken.findFirst({
    where: { tokenHash, expiresAt: { gt: new Date() }, usedAt: null },
  });
}

export function updatePassword(userId: string, passwordHash: string) {
  return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export function consumeReset(id: string) {
  return prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
}

export function revokeAllSessions(userId: string) {
  return prisma.session.deleteMany({ where: { userId } });
}
