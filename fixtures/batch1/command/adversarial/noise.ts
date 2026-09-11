import express from "express";

const app = express();
function exec(input: string) {
  return input.length;
}
app.get("/safe", (req, res) => {
  const text = "child_process.exec(req.query.command)";
  // exec(req.query.command)
  res.json({ length: exec(String(req.query.command)), text });
});
