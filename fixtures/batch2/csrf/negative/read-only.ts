import express from "express";
import session from "express-session";

const app = express();
app.use(session({ secret: "fixture-only", resave: false, saveUninitialized: false }));

export function profile(req, res) {
  return res.json({ userId: req.session.userId });
}

app.get("/account", profile);
