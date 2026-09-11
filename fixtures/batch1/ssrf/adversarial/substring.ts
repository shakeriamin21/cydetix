import axios from "axios";
import express from "express";

const app = express();
app.get("/proxy", async (req, res) => {
  const target = String(req.query.url);
  if (!target.includes("company.com")) return res.sendStatus(400);
  res.json((await axios.get(target)).data);
});
