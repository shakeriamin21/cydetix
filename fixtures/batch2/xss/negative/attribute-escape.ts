import escapeHtml from "escape-html";
import express from "express";

const app = express();

app.get("/label", function label(req, res) {
  const title = escapeHtml(String(req.query.title));
  return res.send(`<span title="${title}">label</span>`);
});
