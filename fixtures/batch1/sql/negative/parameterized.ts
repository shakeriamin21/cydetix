import { Pool } from "pg";
import express from "express";

const pool = new Pool();
const app = express();
app.get("/users", async (req, res) => {
  const rows = await pool.query("SELECT * FROM users WHERE id = $1", [req.query.id]);
  res.json(rows);
});
