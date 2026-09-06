export function findDocument(id, userId) {
  return prisma.document.findUnique({ where: { id } });
}

export function listAuditEvents(category) {
  return prisma.auditEvent.findMany({ where: { category } });
}
