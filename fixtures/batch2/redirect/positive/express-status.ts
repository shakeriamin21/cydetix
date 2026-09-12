import express from "express";

const app = express();

app.get("/continue", function continueRoute(req, res) {
  const target = req.body.returnTo;
  return res.redirect(302, target);
});
