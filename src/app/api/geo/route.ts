import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  let countryCode = request.headers.get("x-vercel-ip-country") || null;

  /* For local development */
  // const hostname = request.nextUrl.hostname;
  // if (hostname === "localhost" || hostname === "127.0.0.1") {
  //   countryCode = "US";
  // }

  return NextResponse.json({
    country_code: countryCode,
  });
}
