import { readFile } from "node:fs/promises";
import express from "express";

const app = express();
app.get("/terms", async (_req, res) => {
  res.send(await readFile("public/terms.txt", "utf8"));
});
