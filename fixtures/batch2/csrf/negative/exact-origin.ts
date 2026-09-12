import express from "express";
import session from "express-session";

const app = express();
const APP_ORIGIN = "https://app.example";
app.use(session({ secret: "fixture-only", resave: false, saveUninitialized: false }));

export function updateEmail(req, res) {
  if (!req.session.userId) return res.sendStatus(401);
  const origin = new URL(req.headers.origin).origin;
  if (origin !== APP_ORIGIN) return res.sendStatus(403);
  return res.json({ updated: req.body.email });
}

app.post("/account/email", updateEmail);
