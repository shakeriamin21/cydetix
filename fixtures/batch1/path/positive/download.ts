import express from "express";

const app = express();
app.get("/download", (req, res) => {
  res.download(req.query.file);
});
