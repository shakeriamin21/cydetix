import express from "express";

const app = express();

app.get("/home", function home(_req, res) {
  return res.redirect("/dashboard");
});
