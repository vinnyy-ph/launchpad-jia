import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { EXCLUDE_ARCHIVED } from "@/lib/utils/careerArchive";

/**
 * Fetches careers for the authenticated user.
 * - Admins/Recruiters: See ALL careers in the organization
 * - Other users: Only see careers where they are listed in the teamMembers array
 *
 * @param {AuthenticatedRequest} req - The authenticated request object.
 * @returns {Promise<NextResponse>} JSON response containing the list of careers or an error message.
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { db } = await connectMongoDB();
    const { orgID, projectId } = await req.json();

    // Get user email from authenticated request
    const userEmail = req.user?.email;

    console.log("[fetch-careers] v2 Starting -", new Date().toISOString(), "- User:", userEmail, "OrgID:", orgID);

    if (!orgID) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    // Check user's role in the organization
    const member = await db.collection("members").findOne({
      email: userEmail.toLowerCase(),
      orgID: orgID,
    });

    const hasFullAccess = member?.role === "admin" || member?.role === "recruiter";

    // Build query based on user role
    // Admins/Recruiters: See ALL careers in the organization
    // Other users: Only see careers where they are team members
    const query: any = {
      orgID: orgID,
      ...EXCLUDE_ARCHIVED,
    };

    let projectCareerIds: ObjectId[] = [];
    let project;
    if (projectId) {
      project = await db.collection("projects").findOne({ _id: new ObjectId(projectId), orgID });
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      projectCareerIds = project.careers.map((c: any) => new ObjectId(c));
      query["_id"] = { $in: projectCareerIds };
    }

    if (!hasFullAccess && projectCareerIds.length === 0) {
      // Non-admins: Only show careers where user is a team member
      query["teamMembers.email"] = userEmail;
    }
    // Admins/Recruiters: No additional filter - see all careers

    console.log("[fetch-careers] User role:", member?.role, "| Has full access:", hasFullAccess);
    console.log("[fetch-careers] Query:", JSON.stringify(query));

    // Fetch careers matching the query
    const careers = await db
      .collection("careers")
      .find(query, {
        projection: {
          questions: 0,
        },
      })
      .sort({ updatedAt: -1 })
      .toArray();

    console.log("[fetch-careers] Found careers:", careers.length, "for user:", userEmail);

    return NextResponse.json(careers);
  } catch (error) {
    console.error("Error fetching careers:", error);
    return NextResponse.json(
      { error: "Failed to fetch careers" },
      { status: 500 }
    );
  }
});
