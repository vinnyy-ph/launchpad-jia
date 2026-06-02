import { getOAuth2Client } from "@/lib/data/google";
import { GmailScopes } from "@/lib/data/googleScope";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgID = searchParams.get("orgID");
  const token = searchParams.get("token");
  const state = encodeURIComponent(JSON.stringify({ token, orgID }));
  const oauth2Client = getOAuth2Client();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: GmailScopes,
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(authUrl);
}
