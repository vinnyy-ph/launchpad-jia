import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { ObjectId } from "mongodb";

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");
    const careerIds = url.searchParams.get("careerIds"); // Comma-separated list

    if (!orgId || !ObjectId.isValid(orgId)) {
      return NextResponse.json(
        { message: "Invalid or missing orgId" },
        { status: 400 },
      );
    }

    if (!careerIds) {
      return NextResponse.json({ careers: [] }, { status: 200 });
    }

    const { db } = await connectMongoDB();
    const careerIdArray = careerIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (careerIdArray.length === 0) {
      return NextResponse.json({ careers: [] }, { status: 200 });
    }

    // Fetch interviews that match the career IDs for this organization
    const interviews = await db
      .collection("interviews")
      .find(
        {
          id: { $in: careerIdArray },
          orgID: orgId,
        },
        {
          projection: {
            id: 1,
            jobTitle: 1,
            status: 1,
          },
        },
      )
      .toArray();

    // Transform to a map format for easier lookup
    const careerData: Record<
      string,
      { jobTitle: string; status: string | null }
    > = {};

    for (const interview of interviews) {
      if (interview.id) {
        careerData[interview.id] = {
          jobTitle: interview.jobTitle || "Unknown Position",
          status: interview.status || null,
        };
      }
    }

    return NextResponse.json({ careers: careerData }, { status: 200 });
  } catch (err) {
    console.error("mg-get-career-data error", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
});
