import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { assessmentId, orgID } = await request.json();

    if (!assessmentId || !orgID) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    const existing = await db.collection("shareable-assessments").findOne({ _id: ObjectId.createFromHexString(assessmentId) });
    if (!existing) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    if (existing.orgID !== orgID) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    await db.collection("shareable-assessments").deleteOne({ _id: ObjectId.createFromHexString(assessmentId) });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shareable assessment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
