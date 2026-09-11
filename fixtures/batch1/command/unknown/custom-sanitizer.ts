import { exec } from "node:child_process";
import express from "express";

const app = express();
declare function quoteForShell(value: unknown): string;
app.get("/run", (req, res) => {
  const value = quoteForShell(req.query.value);
  exec("tool " + value);
  res.sendStatus(204);
});
