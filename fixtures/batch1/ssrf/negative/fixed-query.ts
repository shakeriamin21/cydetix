export async function GET(request: Request) {
  const query = request.nextUrl.searchParams.get("q");
  const url = new URL("https://search.example.test/");
  url.searchParams.set("q", query ?? "");
  return fetch(url);
}
