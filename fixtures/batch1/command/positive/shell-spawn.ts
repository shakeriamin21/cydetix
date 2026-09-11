import { spawn } from "node:child_process";
import express from "express";

const app = express();
app.get("/convert", (req, res) => {
  spawn("convert " + req.body.name, [], { shell: true });
  res.sendStatus(202);
});
