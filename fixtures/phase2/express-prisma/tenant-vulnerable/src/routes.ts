import { requireAuth } from "./auth.js";
import { getDocument } from "./controller.js";

router.get("/tenant/documents/:id", requireAuth, getDocument);
