import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

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
    
    // ALWAYS log what we're returning for debugging
    console.log("[fetch-careers] Returning career IDs:", careers.map((c: any) => c._id?.toString()));
    console.log("[fetch-careers] Returning career titles:", careers.map((c: any) => c.jobTitle));
    
    // Debug: Log all careers in org to compare
    const allCareersInOrg = await db.collection("careers").find({ orgID }).toArray();
    console.log("[fetch-careers] TOTAL careers in org (unfiltered):", allCareersInOrg.length);
    console.log("[fetch-careers] FILTERED careers for user:", careers.length);
    
    if (hasFullAccess) {
      console.log("[fetch-careers] Admin/Recruiter - showing ALL careers");
    } else if (allCareersInOrg.length !== careers.length) {
      console.log("[fetch-careers] FILTERING IS WORKING - showing", careers.length, "of", allCareersInOrg.length, "careers");
    } else if (allCareersInOrg.length > 0) {
      console.log("[fetch-careers] User sees ALL careers - may be admin or all careers have this user as team member");
    }

    return NextResponse.json(careers);
  } catch (error) {
    console.error("Error fetching careers:", error);
    return NextResponse.json(
      { error: "Failed to fetch careers" },
      { status: 500 }
    );
  }
});
