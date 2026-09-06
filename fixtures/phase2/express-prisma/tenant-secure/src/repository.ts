export function findDocument(id, authTenantId, requestedTenantId) {
  return prisma.document.findFirst({ where: { id, tenantId: authTenantId } });
}
