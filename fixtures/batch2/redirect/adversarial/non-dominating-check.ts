import express from "express";

const app = express();
const allowedRedirectHosts = new Set(["docs.example"]);

app.get("/continue", function continueRoute(req, res) {
  const parsed = new URL(String(req.query.next));
  if (req.query.audit === "true") {
    allowedRedirectHosts.has(parsed.hostname);
    parsed.protocol === "https:";
  }
  return res.redirect(parsed.href);
});
