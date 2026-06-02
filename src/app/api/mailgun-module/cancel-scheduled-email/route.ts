import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { isValidObjectId } from "@/lib/utils/requisitionAuthGuard";

/**
 * Cancels a scheduled email by deleting it from the schedule-email collection
 * (or updating status to "cancelled"). Requires auth.
 */

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const { _id, orgID } = body || {};

    if (!_id) {
      return NextResponse.json(
        { error: "Scheduled email ID (_id) is required" },
        { status: 400 }
      );
    }
    if (!orgID) {
      return NextResponse.json(
        { error: "Organization ID (orgID) is required" },
        { status: 400 }
      );
    }
    if (!isValidObjectId(_id)) {
      return NextResponse.json(
        { error: "Invalid scheduled email ID format" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    const scheduleEmailCollection = db.collection("schedule-email");

    const existing = await scheduleEmailCollection.findOne({
      _id: new ObjectId(_id),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Scheduled email not found" },
        { status: 404 }
      );
    }

    if (String(existing.orgID) !== String(orgID)) {
      return NextResponse.json(
        { error: "Organization access denied" },
        { status: 403 }
      );
    }

    await scheduleEmailCollection.deleteOne({
      _id: new ObjectId(_id),
      orgID: String(orgID),
    });

    return NextResponse.json({
      success: true,
      message: "Scheduled email cancelled",
    });
  } catch (error: unknown) {
    console.error("cancel-scheduled-email error", error);
    return NextResponse.json(
      {
        error: "Failed to cancel scheduled email",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
});
