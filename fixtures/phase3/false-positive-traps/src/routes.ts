import { Router } from "express";
import { requireToken } from "./auth.js";
import { unrelatedState } from "./controller.js";

export const router = Router();
router.get("/draft", requireToken, unrelatedState);
