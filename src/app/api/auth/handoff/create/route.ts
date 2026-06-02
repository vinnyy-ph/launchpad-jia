/**
 * POST /api/auth/handoff/create
 *
 * Called by the client on talentvault.{domain} after a successful Firebase
 * login.  Creates a one-time handoff code, stores the hash in MongoDB, and
 * returns the plaintext code inside an HttpOnly cookie on the parent domain
 * (Path=/ so it reaches both /auth/handoff and /api/auth/handoff/consume).
 *
 * Requires: Bearer token (Firebase ID token) in Authorization header.
 */

import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { createHandoffCode } from "@/lib/mongoDB/handoffCodes";

function isValidRedirectPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false; // protocol-relative URL
  if (/^\/[a-z]+:/i.test(path)) return false;
  try {
    // Must not parse as an absolute URL
    new URL(path); // if this succeeds, it's absolute
    return false;
  } catch {
    return true;
  }
}

/**
 * Derive the parent domain for cookie setting.
 */
function getParentCookieDomain(targetHost: string): string {
  const hostname = targetHost.split(":")[0];
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return hostname;
  }
  return `.${hostname}`;
}

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { target = "employer" } = body;

    // Resolve target domain based on handoff direction
    const targetHost =
      target === "applicant"
        ? process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN || ""
        : process.env.NEXT_PUBLIC_EMPLOYER_APP_DOMAIN || "";

    // Default redirect path depends on target
    const defaultRedirectPath = target === "applicant" ? "/dashboard" : "/recruiter-dashboard";
    const { redirectPath = defaultRedirectPath } = body;

    // Validate redirectPath
    if (typeof redirectPath !== "string" || !isValidRedirectPath(redirectPath)) {
      return NextResponse.json(
        { error: "Invalid redirectPath" },
        { status: 400 }
      );
    }

    if (!targetHost) {
      return NextResponse.json(
        { error: "Target domain not configured" },
        { status: 500 }
      );
    }

    const { code, expiresInSeconds } = await createHandoffCode(
      request.user.uid,
      targetHost,
      redirectPath
    );

    const isLocal =
      targetHost.startsWith("localhost") || targetHost.startsWith("127.0.0.1");
    const protocol = isLocal ? "http" : "https";
    const redirectUrl = `${protocol}://${targetHost}/auth/handoff`;

    const cookieDomain = getParentCookieDomain(targetHost);

    const response = NextResponse.json({
      success: true,
      redirectUrl,
    });

    // Set HttpOnly cookie on parent domain — Path=/ so it's sent to
    // both /auth/handoff (page) and /api/auth/handoff/consume (API).
    response.cookies.set("auth_handoff", code, {
      domain: cookieDomain,
      path: "/",
      httpOnly: true,
      secure: !isLocal,
      sameSite: "lax",
      maxAge: expiresInSeconds,
    });

    return response;
  } catch (error: any) {
    if (error?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Too many handoff requests. Please try again shortly." },
        { status: 429 }
      );
    }
    console.error("[Handoff Create] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
