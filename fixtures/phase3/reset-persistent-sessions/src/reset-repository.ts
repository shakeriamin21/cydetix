import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function issueReset(userId: string, tokenHash: string, expiresAt: Date) {
  return prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
}

export function findReset(tokenHash: string) {
  return prisma.passwordResetToken.findFirst({
    where: { tokenHash, expiresAt: { gt: new Date() } },
  });
}

export function updatePassword(userId: string, passwordHash: string) {
  return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
