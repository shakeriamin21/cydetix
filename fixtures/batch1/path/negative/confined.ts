import { readFile } from "node:fs/promises";
import path from "node:path";
import express from "express";

const ROOT = path.resolve("uploads");
const app = express();
app.get("/files", async (req, res) => {
  const candidate = path.resolve(ROOT, String(req.query.path));
  if (!candidate.startsWith(ROOT + path.sep)) return res.sendStatus(400);
  res.send(await readFile(candidate, "utf8"));
});
