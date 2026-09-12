import express from "express";

const app = express();

export function sessionGuard(_req, _res, next) {
  next();
}

export function updateEmail(req, res) {
  return res.json({ updated: req.body.email });
}

app.post("/account/email", sessionGuard, updateEmail);
