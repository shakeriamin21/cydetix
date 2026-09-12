import express from "express";

const app = express();

app.get("/preview", function preview(req, res) {
  const html = req.query.html;
  return res.send(html);
});
