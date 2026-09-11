import { spawn } from "node:child_process";
import express from "express";

const app = express();
app.get("/lookup", (req, res) => {
  spawn("nslookup", [String(req.query.host)], { shell: false });
  res.sendStatus(202);
});
