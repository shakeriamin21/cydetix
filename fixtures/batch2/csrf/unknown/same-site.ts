import express from "express";
import session from "express-session";

const app = express();
app.use(
  session({
    secret: "fixture-only",
    resave: false,
    saveUninitialized: false,
    cookie: { sameSite: "strict" },
  }),
);

export function updateEmail(req, res) {
  if (!req.session.userId) return res.sendStatus(401);
  req.session.email = req.body.email;
  return res.json({ updated: true });
}

app.post("/account/email", updateEmail);
