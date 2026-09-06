import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function createSession(userId: string, id: string) {
  return prisma.session.create({ data: { id, userId } });
}

export function lookupSession(id: string) {
  return prisma.session.findUnique({ where: { id } });
}
