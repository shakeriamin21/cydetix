export async function GET(request: Request) {
  const target = request.nextUrl.searchParams.get("target");
  return fetch(target);
}
