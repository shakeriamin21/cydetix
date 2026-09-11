import axios from "axios";
import express from "express";

const app = express();
app.post("/notify", async (req, res) => {
  const response = await axios.post("https://api.example.test/events", req.body);
  res.json(response.data);
});
