import { Pool } from "pg";
import express from "express";

const pool = new Pool();
const app = express();
app.get("/users", async (_req, res) => {
  res.json(await pool.query("SELECT * FROM users WHERE active = true"));
});
