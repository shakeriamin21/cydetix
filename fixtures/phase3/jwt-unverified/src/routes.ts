import { Router } from "express";
import { requireToken } from "./auth.js";
import { account } from "./controller.js";

export const router = Router();
router.get("/account", requireToken, account);
