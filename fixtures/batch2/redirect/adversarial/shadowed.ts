import express from "express";

const app = express();

app.get("/noop", function noop(req, res) {
  const redirect = (value) => ({ value });
  return res.json(redirect(req.query.next));
});
