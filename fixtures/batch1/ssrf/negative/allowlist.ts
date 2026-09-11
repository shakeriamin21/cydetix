import axios from "axios";
import express from "express";

const allowedHosts = new Set(["api.example.test"]);
const app = express();
app.get("/proxy", async (req, res) => {
  const target = new URL(String(req.query.url));
  if (target.protocol !== "https:") return res.sendStatus(400);
  if (!allowedHosts.has(target.hostname)) return res.sendStatus(400);
  res.json((await axios.get(target)).data);
});
