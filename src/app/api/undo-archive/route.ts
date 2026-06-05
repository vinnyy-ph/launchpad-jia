import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { logActivity } from "@/lib/utils/activityLogger";
import { undoCareerUpdate } from "@/lib/utils/careerArchive";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { batchId } = await request.json();
    if (!batchId) return NextResponse.json({ error: "batchId is required" }, { status: 400 });

    const { db } = await connectMongoDB();
    const careers = await db.collection("careers").find({ archiveBatchId: batchId }).toArray();
    if (!careers.length) return NextResponse.json({ error: "Nothing to undo" }, { status: 404 });

    const userEmail = request.user?.email;
    const orgID = careers[0].orgID;
    // Job-Owner gate: user must own at least one career in the batch.
    const isJobOwner = careers.some((c: any) => c.teamMembers?.some((m: any) => m.email === userEmail && m.role === "Job Owner"));
    if (!isJobOwner) return NextResponse.json({ error: "Only Job Owners can undo this" }, { status: 403 });

    await db.collection("careers").bulkWrite(
      careers.map((c: any) => ({ updateOne: { filter: { _id: c._id }, update: undoCareerUpdate(c) } }))
    );

    // un-drop the candidates dropped in this batch
    const undrop = await db.collection("interviews").updateMany(
      { orgID, archiveBatchId: batchId },
      { $set: { applicationStatus: "Ongoing", updatedAt: new Date() }, $unset: { interviewStatus: "", droppedReason: "", archiveBatchId: "" } }
    );

    try {
      const parent = careers.find((c: any) => !c.parentCareerID) || careers[0];
      await logActivity({ db, kind: "recruiter_restored_career", career: { _id: parent._id, jobTitle: parent.jobTitle, id: parent.id }, orgID, careerId: parent._id?.toString(), actor: { type: "recruiter", id: request.user?.uid, email: userEmail, name: request.user?.name || userEmail || "Recruiter", image: (request.user as any)?.picture } });
    } catch (e) { console.error("[undo-archive] activity log failed:", e); }

    return NextResponse.json({ success: true, restoredCount: careers.length, undroppedCount: undrop.modifiedCount ?? 0 });
  } catch (error) {
    console.error("Error undoing archive:", error);
    return NextResponse.json({ error: "Failed to undo archive" }, { status: 500 });
  }
});
