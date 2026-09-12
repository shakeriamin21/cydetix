import express from "express";

const app = express();

app.get("/settings", function settings(req, res) {
  const model = { innerHTML: "" };
  model.innerHTML = String(req.query.preference);
  return res.json(model);
});
