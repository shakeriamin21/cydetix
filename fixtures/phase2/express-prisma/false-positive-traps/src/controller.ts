import { findDocument, listAuditEvents } from "./repository.js";

export function getDocument(req, res) {
  return findDocument(req.params.id, req.auth.userId);
}

export function listPublicAuditEvents(req, res) {
  return listAuditEvents("public");
}
