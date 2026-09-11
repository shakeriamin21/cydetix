import axios from "axios";
import express from "express";

const app = express();
declare function trustedUrl(value: unknown): string;
app.get("/proxy", async (req, res) => {
  const target = trustedUrl(req.query.url);
  res.json((await axios.get(target)).data);
});
