import { Pool } from "pg";
import express from "express";

const pool = new Pool();
const app = express();
app.get("/users", async (req, res) => {
  const id = req.query.id;
  const sql = "SELECT * FROM users WHERE id = " + id;
  const rows = await pool.query(sql);
  res.json(rows);
});
