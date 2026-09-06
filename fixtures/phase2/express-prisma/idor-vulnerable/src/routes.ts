import { requireAuth } from "./auth.js";
import { getDocument } from "./controller.js";

router.get("/documents/:id", requireAuth, getDocument);
