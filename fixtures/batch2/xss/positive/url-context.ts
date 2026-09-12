import escapeHtml from "escape-html";
import express from "express";

const app = express();

app.get("/link", function link(req, res) {
  const target = escapeHtml(String(req.query.target));
  return res.send(`<a href="${target}">continue</a>`);
});
