import express from "express";

const app = express();
const DESTINATIONS = { docs: "/docs", account: "/account" };

app.get("/continue", function continueRoute(req, res) {
  return res.redirect(DESTINATIONS[req.query.page] ?? "/");
});
