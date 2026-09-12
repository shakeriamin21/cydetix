import express from "express";

const app = express();

app.get("/profile", function profile(req) {
  const biography = req.query.biography;
  return <section dangerouslySetInnerHTML={{ __html: biography }} />;
});
