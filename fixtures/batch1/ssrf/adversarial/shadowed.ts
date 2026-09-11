import express from "express";
import axios from "axios";

const app = express();
app.get("/safe", (req, res) => {
  const axios = { get: (value: unknown) => value };
  res.json(axios.get(req.query.url));
});
void axios;
