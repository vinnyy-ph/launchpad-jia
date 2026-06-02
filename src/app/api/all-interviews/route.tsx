import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { db } = await connectMongoDB();
    const { orgID } = await request.json();
    const results = await db
      .collection("interviews")
      .find({ orgID })
      .sort({ completedAt: -1 })
      .toArray();

    return NextResponse.json(results);
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Failed to fetch interviews" },
      { status: 500 }
    );
  }
});
