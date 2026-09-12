import express from "express";

const app = express();

app.get("/profile", function profile(req) {
  return <p>{req.query.biography}</p>;
});
