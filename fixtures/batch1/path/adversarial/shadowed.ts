import express from "express";
import { readFile } from "node:fs";

const app = express();
app.get("/safe", (req, res, readFile) => {
  res.send(readFile(req.query.path));
});
void readFile;
