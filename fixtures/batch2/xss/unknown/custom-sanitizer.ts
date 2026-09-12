import express from "express";

const app = express();

app.get("/preview", function preview(req, res) {
  const html = sanitizeForOurTemplates(req.query.html);
  return res.send(html);
});
