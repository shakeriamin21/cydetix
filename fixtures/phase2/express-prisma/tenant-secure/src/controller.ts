import { loadDocument } from "./service.js";

export function getDocument(req, res) {
  return loadDocument(req.params.id, req.auth.tenantId, req.body.tenantId);
}
