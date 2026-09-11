import { readFile } from "node:fs/promises";
import express from "express";

const app = express();
declare function sanitizePath(value: unknown): string;
app.get("/files", async (req, res) => {
  const candidate = sanitizePath(req.query.path);
  res.send(await readFile(candidate, "utf8"));
});
