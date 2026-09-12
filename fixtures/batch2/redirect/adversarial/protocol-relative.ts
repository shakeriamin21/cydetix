import express from "express";

const app = express();

app.get("/continue", function continueRoute(req, res) {
  const target = String(req.query.next);
  if (!target.startsWith("/")) return res.redirect("/");
  return res.redirect(target);
});
