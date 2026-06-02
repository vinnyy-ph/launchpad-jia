import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { validateShareableAssessmentPasscode } from "@/lib/utils/shareableAssessmentAccess";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { assessmentId, passcode } = await request.json();

    const result = await validateShareableAssessmentPasscode(
      assessmentId,
      passcode,
      request.user
    );

    if (result.status === 400) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    if (result.status === 404 || !result.assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (result.status === 403 || !result.authorized) {
      return NextResponse.json({ error: result.message || "You are not authorized to access this assessment" }, { status: 403 });
    }

    return NextResponse.json({ success: true, valid: result.valid });
  } catch (error) {
    console.error("Error validating password:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
