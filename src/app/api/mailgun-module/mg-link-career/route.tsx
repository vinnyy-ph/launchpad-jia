import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const { threadId, careerId, orgId } = body;

    if (!threadId) {
      return NextResponse.json(
        { error: "Thread ID is required" },
        { status: 400 }
      );
    }

    if (!careerId) {
      return NextResponse.json(
        { error: "Career ID is required" },
        { status: 400 }
      );
    }

    if (!orgId || !ObjectId.isValid(orgId)) {
      return NextResponse.json(
        { error: "Valid organization ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    const userEmail = req.user?.email;
    if (!userEmail) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const orgObjectId = new ObjectId(orgId);

    // Verify membership
    const memberInOrg = await db.collection("members").findOne({
      email: userEmail,
      $or: [
        { orgID: orgId },
        { orgID: orgObjectId },
        { organizationId: orgId },
        { organizationId: orgObjectId },
      ],
    });

    if (!memberInOrg) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Verify thread exists and belongs to the organization
    const threadObjectId = ObjectId.isValid(threadId)
      ? new ObjectId(threadId)
      : null;

    if (!threadObjectId) {
      return NextResponse.json(
        { error: "Invalid thread ID format" },
        { status: 400 }
      );
    }

    const thread = await db.collection("mailgun-threads").findOne({
      _id: threadObjectId,
      organizationId: { $in: [orgObjectId, orgId].filter(Boolean) },
    });

    if (!thread) {
      return NextResponse.json(
        { error: "Thread not found or access denied" },
        { status: 404 }
      );
    }

    // Verify career exists and belongs to the organization
    const career = await db.collection("careers").findOne({
      id: careerId,
      orgID: orgId,
    });

    if (!career) {
      return NextResponse.json(
        { error: "Career not found or access denied" },
        { status: 404 }
      );
    }

    // Update thread with careerId
    const updateResult = await db.collection("mailgun-threads").updateOne(
      { _id: threadObjectId },
      {
        $set: {
          careerId: String(careerId),
          lastUpdated: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: "Thread not found" },
        { status: 404 }
      );
    }

    if (updateResult.modifiedCount === 0) {
      // Thread exists but wasn't modified (maybe same careerId already set)
      console.log("Thread already has this careerId:", careerId);
    }

    return NextResponse.json({
      success: true,
      message: "Career linked to thread successfully",
      careerId: String(careerId),
    });
  } catch (error: any) {
    console.error("Error linking career to thread:", error);
    return NextResponse.json(
      { error: "Failed to link career to thread", details: error.message },
      { status: 500 }
    );
  }
});
