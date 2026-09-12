import escapeHtml from "escape-html";
import express from "express";

const app = express();

app.get("/hello", function hello(req, res) {
  return res.send(escapeHtml(String(req.query.name)));
});
