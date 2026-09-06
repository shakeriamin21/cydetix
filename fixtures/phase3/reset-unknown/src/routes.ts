import { Router } from "express";
import { completePasswordReset } from "./controller.js";

export const router = Router();
router.post("/password-reset/complete", completePasswordReset);
