import express from "express";

const app = express();

app.get("/login", function login(_req, res) {
  return res.redirect("https://identity.example/login");
});
