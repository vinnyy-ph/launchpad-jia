import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

/**
 * Hard delete is retired (T4 / JIA-352): archive-career is the only removal
 * path — reversible, cascade-aware, and excluded from listings/analytics.
 * T4 removed every UI caller of this endpoint; the route now answers 410 Gone
 * so any stray caller gets an explicit pointer instead of silently destroying
 * data. Restore paths: /api/restore-career (explicit) and /api/undo-archive
 * (the toast Undo, by batch).
 */
export const POST = withAuth(async (_request: AuthenticatedRequest) => {
  return NextResponse.json(
    {
      error:
        "Career deletion has been retired. Archive instead via /api/archive-career (reversible with /api/restore-career or /api/undo-archive).",
    },
    { status: 410 }
  );
});
