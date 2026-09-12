import { NextResponse } from "next/server";

export function GET(request) {
  const target = request.nextUrl.searchParams.get("next");
  return NextResponse.redirect(target);
}
