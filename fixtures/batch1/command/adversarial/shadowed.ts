import express from "express";
import { exec } from "node:child_process";

const app = express();
app.get("/safe", (req, res, exec) => {
  res.json(exec(req.query.value));
});
void exec;
