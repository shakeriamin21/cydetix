import csrf from "csurf";
import express from "express";
import session from "express-session";

const app = express();
const csrfProtection = csrf();
app.use(session({ secret: "fixture-only", resave: false, saveUninitialized: false }));
app.use(csrfProtection);

export function updateEmail(req, res) {
  if (!req.session.userId) return res.sendStatus(401);
  return res.json({ updated: req.body.email });
}

app.post("/account/email", updateEmail);
