import axios from "axios";
import express from "express";

const app = express();
app.get("/proxy", async (req, res) => {
  const target = req.query.url;
  const response = await axios.get(target);
  res.send(response.data);
});
