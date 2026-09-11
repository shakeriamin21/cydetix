import { fetch } from "undici";
import express from "express";

const app = express();
async function requestRemote(target: unknown) {
  return fetch(String(target));
}
app.get("/proxy", async (req, res) => {
  res.send(await requestRemote(req.body.destination));
});
