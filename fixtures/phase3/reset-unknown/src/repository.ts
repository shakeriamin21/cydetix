import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function findReset(tokenHash: string) {
  return prisma.passwordResetToken.findFirst({
    where: { tokenHash, expiresAt: { gt: new Date() }, usedAt: null },
  });
}

export function updatePassword(userId: string, passwordHash: string) {
  return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export function consumeReset(id: string) {
  return prisma.passwordResetToken.delete({ where: { id } });
}
