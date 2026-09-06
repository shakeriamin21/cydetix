export function findDocument(id, userId) {
  return prisma.document.findFirst({ where: { id, ownerId: userId } });
}
