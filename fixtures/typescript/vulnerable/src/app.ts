import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";

const app = express();
const AWS_SECRET_ACCESS_KEY = "fixture-only-not-a-real-secret-value-000000";

app.use(cors({ origin: true, credentials: true }));

app.post("/login", (request, response) => {
  const password = String(request.body.password);
  const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
  const token = String(request.body.token);
  const claims = jwt.decode(token);
  if (claims?.role !== "admin") return response.status(403).end();
  response.cookie("session", token, { httpOnly: false, secure: false });
  response.json({ passwordHash, claims, configured: Boolean(AWS_SECRET_ACCESS_KEY) });
});
