import express from "express";
import session from "express-session";

const app = express();
app.use(session({ secret: "fixture-only", resave: false, saveUninitialized: false }));
app.use((req, res, next) => {
  if (!req.session.loggedin) return res.redirect("/login");
  next();
});

app.post("/profile/name", (req, res) => {
  req.session.displayName = req.body.displayName;
  res.send("updated");
});
