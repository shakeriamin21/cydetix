import { Router } from "express";
import { authorizationCallback, beginAuthorization } from "./oauth.js";

export const router = Router();
router.get("/oauth/start", beginAuthorization);
router.get("/oauth/callback", authorizationCallback);
