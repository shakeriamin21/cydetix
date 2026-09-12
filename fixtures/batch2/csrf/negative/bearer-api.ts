import express from "express";
import jwt from "jsonwebtoken";

const app = express();

export function updateRecord(req, res) {
  const token = req.headers.authorization;
  jwt.verify(token, process.env.JWT_PUBLIC_KEY);
  return res.json({ updated: true });
}

app.post("/api/record", updateRecord);
