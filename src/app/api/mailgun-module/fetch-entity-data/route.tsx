import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { careerId, orgId, interviewId } = body;

    // Validate required parameters
    if (!careerId || !orgId) {
      console.error("[fetch-entity-data] Missing required data: careerId or orgId");
      return NextResponse.json(
        {
          success: false,
          error: "Missing required data",
        },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Fetch data in parallel
    const [interviews, organizations, careers] = await Promise.all([
      interviewId
        ? db.collection("interviews").findOne({ interviewID: interviewId })
        : Promise.resolve(null),
      db.collection("organizations").findOne({ _id: new ObjectId(orgId) }),
      db.collection("careers").findOne({ _id: new ObjectId(careerId) }),
    ]);

    return NextResponse.json({
      success: true,
      interviews: interviews || null,
      organizations: organizations || null,
      careers: careers || null,
    });
  } catch (error) {
    console.error("Error in fetch-entity-data endpoint:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
});
