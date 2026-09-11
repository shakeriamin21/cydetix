import { exec as execute } from "node:child_process";
import express from "express";

const app = express();
app.get("/diagnostics", (req, res) => {
  const host = req.query.host;
  execute(`ping -c 1 ${host}`);
  res.sendStatus(204);
});
