import express from "express";

const app = express();
function readFile(value: string) {
  return value;
}
const sample = "fs.readFile(req.query.path)";
app.get("/safe", (req, res) => {
  // fs.readFile(req.query.path)
  res.send(readFile(String(req.query.path)) + sample);
});
