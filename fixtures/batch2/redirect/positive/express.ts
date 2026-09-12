import express from "express";

const app = express();

app.get("/continue", function continueRoute(req, res) {
  return res.redirect(req.query.next);
});
