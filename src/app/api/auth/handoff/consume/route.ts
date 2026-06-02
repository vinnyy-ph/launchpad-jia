/**
 * POST /api/auth/handoff/consume
 *
 * Called by the /auth/handoff page on the canonical domain. Reads the
 * auth_handoff cookie (sent automatically because the cookie's Path
 * matches), validates + deletes the code from MongoDB, and returns a
 * Firebase custom token that the client uses to bootstrap a session.
 *
 * No auth required – the user is unauthenticated on this domain; the
 * handoff code is the proof of identity.
 */

import { NextRequest, NextResponse } from "next/server";
import { consumeHandoffCode } from "@/lib/mongoDB/handoffCodes";
import { createCustomToken } from "@/lib/firebase/firebaseAdmin";

function clearHandoffCookie(response: NextResponse, requestHost: string) {
  const hostname = requestHost.split(":")[0];
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  const domain = isLocal ? hostname : `.${hostname}`;

  response.cookies.set("auth_handoff", "", {
    domain,
    path: "/",
    httpOnly: true,
    secure: !isLocal,
    sameSite: "lax",
    maxAge: 0,
  });
}

export async function POST(request: NextRequest) {
  try {
    const code = request.cookies.get("auth_handoff")?.value;

    if (!code) {
      return NextResponse.json(
        { error: "Missing handoff code" },
        { status: 401 }
      );
    }

    const host = request.headers.get("host") || "";

    // Explicit host validation: reject non-local requests to mismatched domains
    const employerHost = (process.env.NEXT_PUBLIC_EMPLOYER_APP_DOMAIN || "").split(":")[0];
    const applicantHost = (process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN || "").split(":")[0];
    const hostname = host.split(":")[0];
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    // Strip leading "www." before comparing so that a www-redirect on the
    // canonical domain doesn't cause a spurious "Invalid domain" rejection.
    const stripWww = (h: string) => h.replace(/^www\./, "");
    const isAllowedHost =
      stripWww(hostname) === stripWww(employerHost) ||
      stripWww(hostname) === stripWww(applicantHost);
    if (!isLocal && !isAllowedHost) {
      const response = NextResponse.json(
        { error: "Invalid domain for handoff" },
        { status: 403 }
      );
      clearHandoffCookie(response, host);
      return response;
    }
    const doc = await consumeHandoffCode(code, host);

    if (!doc) {
      const response = NextResponse.json(
        { error: "Invalid or expired handoff code" },
        { status: 401 }
      );
      clearHandoffCookie(response, host);
      return response;
    }

    // Generate a Firebase custom token for the user
    const customToken = await createCustomToken(doc.uid);

    const response = NextResponse.json({
      customToken,
      redirectPath: doc.redirectPath || "/recruiter-dashboard",
    });

    clearHandoffCookie(response, host);

    return response;
  } catch (error) {
    console.error("[Handoff Consume] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
