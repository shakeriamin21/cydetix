import express from "express";

const app = express();

function renderMessage(message) {
  return `<p>${message}</p>`;
}

app.get("/message", function message(req, res) {
  const input = req.query.message;
  return res.send(renderMessage(input));
});
