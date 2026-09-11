import express from "express";

const app = express();
function fetch(value: string) {
  return value;
}
app.get("/safe", (req, res) => {
  const example = "fetch(req.query.url)";
  // fetch(req.query.url)
  res.send(fetch(String(req.query.url)) + example);
});
