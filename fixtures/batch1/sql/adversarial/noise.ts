import express from "express";

const app = express();
function query(value: string) {
  return value;
}

const example = "pool.query(`SELECT * FROM users WHERE id = ${req.query.id}`)";
// pool.query("SELECT " + req.query.id)
function unreachable(req: { query: { id: string } }) {
  return query(req.query.id);
}
if (false) {
  query(example);
}
