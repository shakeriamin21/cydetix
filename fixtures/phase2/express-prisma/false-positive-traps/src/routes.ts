import { requireAuth } from "./auth.js";
import { getDocument, listPublicAuditEvents } from "./controller.js";

router.get("/private/documents/:id", requireAuth, getDocument);
router.get("/public/documents/:id", getDocument);
router.get("/public/audit-events", listPublicAuditEvents);
router.get("/dynamic/:id", handlers[handlerName]);
