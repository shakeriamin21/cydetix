import express from "express";

const app = express();

app.get("/continue", function continueRoute(req, res) {
  const target = enforceCompanyRedirectPolicy(req.query.next);
  return res.redirect(target);
});
