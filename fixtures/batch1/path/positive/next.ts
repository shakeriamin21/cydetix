import { readFile } from "node:fs/promises";

export async function GET(request: Request) {
  const requestedPath = request.nextUrl.searchParams.get("path");
  return new Response(await readFile(requestedPath, "utf8"));
}
