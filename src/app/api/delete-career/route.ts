import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { logActivity } from "@/lib/utils/activityLogger";
import { triggerCareerDeleteNotification } from "@/lib/utils/notificationTriggers";
import { Project } from "@/lib/types/projects";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { id } = await request.json();

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: "Career ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // First, fetch the career to check access
    const existingCareer = await db
      .collection("careers")
      .findOne({ _id: new ObjectId(id) });

    if (!existingCareer) {
      return NextResponse.json({ error: "Career not found" }, { status: 404 });
    }

    // Check if user has access to this career (must be Job Owner)
    const userEmail = request.user?.email;
    const isJobOwner = existingCareer.teamMembers?.some(
      (member: any) => member.email === userEmail && member.role === "Job Owner"
    );

    if (!isJobOwner) {
      return NextResponse.json(
        { error: "Only Job Owners can delete this career" },
        { status: 403 }
      );
    }

    // Store career info before deletion for notification
    const careerTitle = existingCareer.jobTitle;
    const careerId = existingCareer._id.toString();
    const orgID = existingCareer.orgID;
    const teamMemberIds = existingCareer.teamMembers?.map((m: any) => m.email).filter(Boolean) || [];

    // Delete the career with the specified ID
    const result = await db
      .collection("careers")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Career not found" }, { status: 404 });
    }

    // Log career deletion activity
    try {
      await logActivity({
        db,
        kind: "recruiter_deleted_career",
        career: {
          _id: existingCareer._id,
          jobTitle: careerTitle,
          id: existingCareer.id,
        },
        orgID,
        careerId: existingCareer._id?.toString(),
        actor: {
          type: "recruiter",
          id: request.user?.uid,
          email: request.user?.email,
          name: request.user?.name || request.user?.email || "Recruiter",
          image: (request.user as any)?.picture,
        },
      });
    } catch (logError) {
      console.error("Failed to log career deletion activity:", logError);
    }

    // Clear dangling parent references for linked child careers
    try {
      if (existingCareer.id) {
        await db.collection("careers").updateMany(
          { orgID, parentCareerID: existingCareer.id },
          {
            $set: {
              parentCareerID: null,
              updatedAt: new Date(),
            },
          }
        );
      }
    } catch (childCleanupError) {
      console.error("[delete-career] Failed to clear child parent references:", childCleanupError);
    }

    // Remove deleted career ID from all projects
    try {
      await db.collection<Project>("projects").updateMany(
        { careers: careerId },
        { $pull: { careers: careerId }, $set: { updatedAt: new Date() } }
      );
    } catch (projectError) {
      console.error('[delete-career] Failed to clean up project references:', projectError);
    }

    // Trigger deletion notification for team members (after successful deletion)
    if (teamMemberIds.length > 0) {
      try {
        await triggerCareerDeleteNotification(db, {
          careerId,
          careerTitle,
          actorId: userEmail,
          recipientIds: teamMemberIds,
          orgID,
        });
      } catch (notificationError) {
        console.error('[delete-career] Failed to trigger deletion notifications:', notificationError);
      }
    }

    return NextResponse.json({
      message: "Career deleted successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error deleting career:", error);
    return NextResponse.json(
      { error: "Failed to delete career" },
      { status: 500 }
    );
  }
});
