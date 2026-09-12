import escapeHtml from "escape-html";
import express from "express";

const app = express();

app.get("/script", function script(req, res) {
  const value = escapeHtml(String(req.query.value));
  return res.send(`<script>window.value = '${value}'</script>`);
});
