import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function issueReset(userId: string, token: string) {
  return prisma.passwordResetToken.create({ data: { userId, token, usedAt: null } });
}

export function findUnusedReset(token: string) {
  return prisma.passwordResetToken.findFirst({ where: { token, usedAt: null } });
}

export function replacePassword(userId: string, passwordHash: string) {
  return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export function consumeReset(id: string) {
  return prisma.passwordResetToken.delete({ where: { id } });
}
