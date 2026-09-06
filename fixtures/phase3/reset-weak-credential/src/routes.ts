import { Router } from "express";
import { completePasswordReset, requestPasswordReset } from "./controller.js";

export const router = Router();
router.post("/password-reset/request", requestPasswordReset);
router.post("/password-reset/complete", completePasswordReset);
