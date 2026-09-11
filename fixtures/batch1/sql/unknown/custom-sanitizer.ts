import { Pool } from "pg";
import express from "express";

const pool = new Pool();
const app = express();
declare function makeSafe(value: unknown): string;
app.get("/users", (req, res) => {
  const maybeSafe = makeSafe(req.query.id);
  res.json(pool.query("SELECT * FROM users WHERE id = " + maybeSafe));
});
