import { getMicrosoftAuthUrl } from "@/lib/data/microsoftAuth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgID = searchParams.get("orgID");
  const token = searchParams.get("token");

  if (!orgID || !token) {
    return NextResponse.json(
      { error: "Missing orgID or token for Microsoft OAuth." },
      { status: 400 }
    );
  }

  const state = encodeURIComponent(JSON.stringify({ token, orgID }));
  const authUrl = getMicrosoftAuthUrl(state);

  return NextResponse.redirect(authUrl);
}
