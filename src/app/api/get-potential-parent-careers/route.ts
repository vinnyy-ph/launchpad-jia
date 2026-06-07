import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { EXCLUDE_ARCHIVED } from "@/lib/utils/careerArchive";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { orgID, excludeCareerID } = await request.json();

    if (!orgID) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Query for careers that can be parents (parent posts):
    // - Same organization
    // - Must be active
    // - Exclude the current career being edited (if provided)
    const filter: any = {
      orgID,
      status: "active",
      // Defense-in-depth: archived careers are forced inactive, but don't rely on
      // that invariant alone to keep them out of the parent-career dropdown.
      ...EXCLUDE_ARCHIVED,
    };

    if (excludeCareerID) {
      filter.id = { $ne: excludeCareerID };
    }

    const careers = await db
      .collection("careers")
      .find(filter)
      .project({
        _id: 1,
        id: 1,
        jobTitle: 1,
        status: 1,
      })
      .sort({ jobTitle: 1 })
      .toArray();

    return NextResponse.json({
      careers,
    });
  } catch (error) {
    console.error("Error fetching potential parent careers:", error);
    return NextResponse.json(
      { error: "Failed to fetch careers" },
      { status: 500 }
    );
  }
});
