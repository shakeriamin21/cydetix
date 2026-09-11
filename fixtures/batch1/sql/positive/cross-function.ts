import { Pool } from "pg";
import express from "express";

const pool = new Pool();
const app = express();
function loadUser(identifier: unknown) {
  const statement = `SELECT * FROM users WHERE id = ${identifier}`;
  return pool.query(statement);
}
app.get("/users/:id", (req, res) => {
  res.json(loadUser(req.params.id));
});
