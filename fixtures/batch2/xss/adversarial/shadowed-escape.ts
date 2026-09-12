import escapeHtml from "escape-html";
import express from "express";

const app = express();

app.get("/preview", function preview(req, res) {
  function render(escapeHtml) {
    return res.send(escapeHtml(req.query.html));
  }
  return render((value) => value);
});
