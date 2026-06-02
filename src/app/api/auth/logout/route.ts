/**
 * POST /api/auth/logout
 *
 * Revokes the user's Firebase refresh tokens server-side, ensuring that:
 * - Existing ID tokens are rejected by verifyIdToken(..., checkRevoked: true)
 * - The user cannot obtain new ID tokens until they sign in again
 *
 * Requires: Bearer token (Firebase ID token) in Authorization header.
 * Call this before clearing localStorage on the client.
 */

import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { admin, getAdminApp } from "@/lib/firebase/firebaseAdmin";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const uid = request.user.uid;
    getAdminApp(); // ensures Firebase Admin is initialized
    await admin.auth().revokeRefreshTokens(uid);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Logout] Error revoking tokens:", error);
    return NextResponse.json(
      { error: "Failed to revoke session" },
      { status: 500 }
    );
  }
});
