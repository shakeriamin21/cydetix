import express from "express";
import session from "express-session";
import { requireSession } from "./session-auth.js";
import { updateEmail } from "./update-email.js";

const app = express();
app.use(session({ secret: "fixture-only", resave: false, saveUninitialized: false }));
app.post("/account/email", requireSession, updateEmail);
