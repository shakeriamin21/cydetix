import { Router } from "express";
import { refresh } from "./controller.js";

export const router = Router();
router.post("/oauth/token/refresh", refresh);
