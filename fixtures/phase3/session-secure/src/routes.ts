import { Router } from "express";
import { login, logout, protectedResource, requireSession } from "./controller.js";

export const router = Router();
router.post("/login", login);
router.get("/account", requireSession, protectedResource);
router.post("/logout", requireSession, logout);
