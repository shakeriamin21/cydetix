import { Pool } from "pg";

const pool = new Pool();
export async function GET(request: Request) {
  const order = request.nextUrl.searchParams.get("order");
  return Response.json(await pool.query(`SELECT * FROM users ORDER BY ${order}`));
}
