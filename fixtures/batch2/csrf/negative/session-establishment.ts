import express from "express";
import session from "express-session";

const app = express();
app.use(session({ secret: "fixture-only", resave: false, saveUninitialized: false }));

app.post("/login", (req, res) => {
  req.session.loggedin = true;
  res.redirect("/account");
});
