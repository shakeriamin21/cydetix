import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import express from "express";

const app = express();
app.post("/upload", async (req, res) => {
  const internalName = randomUUID() + ".bin";
  await writeFile("uploads/" + internalName, req.body);
  res.sendStatus(201);
});
