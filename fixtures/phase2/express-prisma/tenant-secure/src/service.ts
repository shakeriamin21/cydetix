import { findDocument } from "./repository.js";

export function loadDocument(id, authTenantId, requestedTenantId) {
  return findDocument(id, authTenantId, requestedTenantId);
}
