import express from "express";
import { writeFileSync } from "node:fs";
import { requireCompanyAuth } from "./custom-auth-impl.js";

const app = express();

export function updateEmail(req, res) {
  writeFileSync("account-email.txt", req.body.email);
  return res.json({ updated: true });
}

app.post("/account/email", requireCompanyAuth, updateEmail);
