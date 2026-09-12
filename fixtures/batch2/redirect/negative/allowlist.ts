import express from "express";

const app = express();
const allowedRedirectHosts = new Set(["accounts.example", "docs.example"]);

app.get("/continue", function continueRoute(req, res) {
  const parsed = new URL(String(req.query.next));
  if (parsed.protocol !== "https:") return res.redirect("/");
  if (!allowedRedirectHosts.has(parsed.hostname)) return res.redirect("/");
  return res.redirect(parsed.href);
});
