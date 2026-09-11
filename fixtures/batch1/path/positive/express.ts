import { readFile } from "node:fs/promises";
import express from "express";

const app = express();
app.get("/files", async (req, res) => {
  const requested = req.query.path;
  res.send(await readFile("uploads/" + requested, "utf8"));
});
