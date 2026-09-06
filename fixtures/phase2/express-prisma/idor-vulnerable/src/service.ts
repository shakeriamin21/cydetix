import { findDocument } from "./repository.js";

export function loadDocument(id, userId) {
  return findDocument(id, userId);
}
