import * as childProcess from "node:child_process";
import express from "express";

const app = express();
function runLookup(name: unknown) {
  return childProcess.execSync("nslookup " + name);
}
app.get("/lookup", (req, res) => {
  res.send(runLookup(req.query.name));
});
