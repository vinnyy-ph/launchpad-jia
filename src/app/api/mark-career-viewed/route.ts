// POST /api/mark-career-viewed
// Marks a career as viewed by a specific team member

import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { ObjectId } from "mongodb";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { careerId, userEmail, orgID } = await request.json();

    if (!careerId || !userEmail || !orgID) {
      console.error("[mark-career-viewed] Missing required data: careerId, userEmail, or orgID");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // First, try to update if user is a team member
    const teamMemberUpdate = await db.collection("careers").updateOne(
      {
        _id: new ObjectId(careerId),
        orgID,
        "teamMembers.email": userEmail,
      },
      {
        $set: {
          "teamMembers.$.isViewed": true,
        },
      }
    );

    // If user is not a team member, add to viewedBy array
    if (teamMemberUpdate.matchedCount === 0) {
      const viewedByUpdate = await db.collection("careers").updateOne(
        {
          _id: new ObjectId(careerId),
          orgID,
        },
        {
          $addToSet: {
            viewedBy: userEmail,
          },
        }
      );

      if (viewedByUpdate.matchedCount === 0) {
        return NextResponse.json(
          { error: "Career not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking career as viewed:", error);
    return NextResponse.json(
      { error: "Failed to mark career as viewed" },
      { status: 500 }
    );
  }
});
