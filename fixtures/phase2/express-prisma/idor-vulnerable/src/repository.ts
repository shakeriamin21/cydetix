export function findDocument(id, userId) {
  return prisma.document.findUnique({ where: { id } });
}
