import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { WithId } from "mongodb";

/**
 * GET /api/get-candidate-emails
 *
 * Retrieves unique candidate emails from active interviews filtered by:
 * - Organization ID (required)
 * - User role and career assignments (if userEmail provided)
 * - Specific career ID (optional)
 *
 * Access Control:
 * - Recruiters (admin role): Can see ALL candidate emails for all careers
 * - Hiring Managers: Can only see emails for their assigned careers
 * - If careerID is provided: Filters by that specific career (applies to all roles)
 *
 * Query parameters:
 * - orgID: Organization ID (required)
 * - userEmail: User email to determine role-based filtering (optional)
 * - careerID: Specific career ID to filter by (optional)
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");
    const userEmail = searchParams.get("userEmail");
    const careerID = searchParams.get("careerID");

    if (!orgID) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Get user's role and career assignments for role-based filtering
    let userRole: string | null = null;
    let userCareerIDs: string[] = [];

    if (userEmail) {
      const member = await db.collection("members").findOne({
        email: userEmail.toLowerCase(),
        orgID: orgID,
      });

      if (member) {
        userRole = member.role;
        // Hiring managers with career assignments can only see their assigned careers
        if (
          member.role === "hiring_manager" &&
          Array.isArray(member.careers) &&
          member.careers.length > 0
        ) {
          userCareerIDs = member.careers;
        }
      }
    }

    // Build interview filter for active applications only
    const interviewFilter: Record<string, any> = {
      orgID: orgID,
      email: { $exists: true, $ne: null },
      $or: [
        { applicationStatus: "Ongoing" },
        { applicationStatus: null },
        { applicationStatus: { $exists: false } },
      ],
    };

    // Apply career-based filtering
    // Note: interviews collection uses 'id' field for career ID, not 'careerID'
    // Recruiters (admin role) and other non-hiring_manager roles see ALL emails regardless of career
    if (careerID) {
      // If specific career is requested, filter by that career
      interviewFilter.id = careerID;
    } else if (userRole === "hiring_manager" && userCareerIDs.length > 0) {
      // Hiring managers with career assignments only see their assigned careers
      interviewFilter.id = { $in: userCareerIDs };
    }
    // Recruiters (admin role) and other roles see all emails - no additional filtering applied

    // Fetch interviews matching the filter criteria
    const interviews = await db
      .collection("interviews")
      .find(interviewFilter, { projection: { email: 1, id: 1, _id: 0 } })
      .toArray();

    // Extract and deduplicate candidate emails
    const candidateEmails = new Set<string>();
    interviews.forEach((interview: WithId<{ email?: string }>) => {
      if (interview.email) {
        candidateEmails.add(interview.email.toLowerCase());
      }
    });

    return NextResponse.json({
      success: true,
      emails: Array.from(candidateEmails),
      count: candidateEmails.size,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to fetch candidate emails",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }
});
