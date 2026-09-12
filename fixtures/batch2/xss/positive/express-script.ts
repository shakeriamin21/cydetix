import escapeHtml from "escape-html";
import express from "express";

const app = express();

app.get("/script", function script(req, res) {
  const name = escapeHtml(String(req.query.name));
  return res.send(`<script>window.profile = '${name}'</script>`);
});
