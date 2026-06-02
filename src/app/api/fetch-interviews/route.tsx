import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { db } = await connectMongoDB();

    const { email } = await request.json();

    const interviews = await db
      .collection("interviews")
      .find({ email: email })
      .sort({ updatedAt: -1 })
      .toArray();

    return NextResponse.json(interviews);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch interviews" },
      { status: 500 }
    );
  }
});
