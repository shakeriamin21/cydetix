import { Router } from "express";
import {
  completePasswordReset,
  establishSession,
  protectedResource,
  requestPasswordReset,
} from "./controller.js";

export const router = Router();
router.post("/password-reset/request", requestPasswordReset);
router.post("/password-reset/complete", completePasswordReset);
router.post("/login/session", establishSession);
router.get("/account", protectedResource);
