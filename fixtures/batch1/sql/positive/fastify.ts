import Fastify from "fastify";
import { Pool } from "pg";

const app = Fastify();
const pool = new Pool();
app.get("/users", async (request) => {
  return pool.query("SELECT * FROM users WHERE id = " + request.query.id);
});
