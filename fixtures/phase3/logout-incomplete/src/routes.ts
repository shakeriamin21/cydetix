import { Router } from "express";
import { logout, protectedResource, requireSession } from "./controller.js";

export const router = Router();
router.get("/account", requireSession, protectedResource);
router.post("/logout", requireSession, logout);
