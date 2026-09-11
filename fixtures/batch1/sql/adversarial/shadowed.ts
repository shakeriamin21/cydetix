import express from "express";
import { Pool } from "pg";

const app = express();
const pool = new Pool();
app.get("/safe", (req, res) => {
  const pool = { query: (value: unknown) => value };
  res.json(pool.query("SELECT " + req.query.id));
});
void pool;
