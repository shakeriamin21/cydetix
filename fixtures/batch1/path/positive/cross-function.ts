import * as fs from "node:fs";
import express from "express";

const app = express();
function loadDocument(name: unknown) {
  const location = "documents/" + name;
  return fs.readFileSync(location, "utf8");
}
app.get("/document", (req, res) => {
  res.send(loadDocument(req.params.name));
});
