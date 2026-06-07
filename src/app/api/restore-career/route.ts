import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { logActivity } from "@/lib/utils/activityLogger";
import { isCareerJobOwner, restoreCareerUpdate } from "@/lib/utils/careerArchive";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "Career ID is required" }, { status: 400 });

    const { db } = await connectMongoDB();
    const career = await db.collection("careers").findOne({ _id: new ObjectId(id) });
    if (!career) return NextResponse.json({ error: "Career not found" }, { status: 404 });

    const userEmail = request.user?.email;
    if (!isCareerJobOwner(career, userEmail)) {
      return NextResponse.json({ error: "Only Job Owners can restore this career" }, { status: 403 });
    }

    // Restore = un-archive only. Publish state stays unpublished + inactive (per spec).
    await db.collection("careers").updateOne(
      { _id: new ObjectId(id) },
      restoreCareerUpdate()
    );

    try {
      await logActivity({
        db,
        kind: "recruiter_restored_career",
        career: { _id: career._id, jobTitle: career.jobTitle, id: career.id },
        orgID: career.orgID,
        careerId: career._id?.toString(),
        actor: {
          type: "recruiter",
          id: request.user?.uid,
          email: userEmail,
          name: request.user?.name || userEmail || "Recruiter",
          image: (request.user as any)?.picture,
        },
      });
    } catch (e) {
      console.error("[restore-career] activity log failed:", e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error restoring career:", error);
    return NextResponse.json({ error: "Failed to restore career" }, { status: 500 });
  }
});
