import { exec } from "node:child_process";
import express from "express";

const app = express();
app.get("/health", (_req, res) => {
  exec("uptime");
  res.sendStatus(204);
});
