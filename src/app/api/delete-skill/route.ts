import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const candidateEmail = searchParams.get("candidateEmail");
    const skillName = searchParams.get("skillName");

    if (!candidateEmail || !skillName) {
      console.error("[delete-skill] Missing required data: candidateEmail or skillName");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Get the authenticated user's orgID from their profile
    const endorserEmail = request.user?.email;
    const userProfile = await db.collection("members").findOne({ email: endorserEmail });
    const orgID = userProfile?.orgID;

    if (!orgID) {
      return NextResponse.json(
        { error: "Organization context is required to delete a skill" },
        { status: 403 }
      );
    }

    // Delete endorsements and org-scoped skills for this org only
    const deleteFilter = { candidateEmail, skillName, orgID };

    const endorsementsDeleteResult = await db
      .collection("skill-endorsements")
      .deleteMany(deleteFilter);

    const metadataDeleteResult = await db
      .collection("org-candidate-skills")
      .deleteMany(deleteFilter);

    return NextResponse.json({
      message: "Skill data removed successfully for this organization",
      endorsementsDeleted: endorsementsDeleteResult.deletedCount,
      metadataDeleted: metadataDeleteResult.deletedCount,
      orgID,
    });
  } catch (error) {
    console.error("Error removing skill endorsements:", error);
    return NextResponse.json(
      { error: "Failed to remove skill endorsements" },
      { status: 500 }
    );
  }
});
