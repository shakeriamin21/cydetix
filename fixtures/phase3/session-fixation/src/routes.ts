import { Router } from "express";
import { login, protectedResource, requireSession } from "./controller.js";

export const router = Router();
router.post("/login", login);
router.get("/account", requireSession, protectedResource);
