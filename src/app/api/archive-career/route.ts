import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { logActivity } from "@/lib/utils/activityLogger";
import { selectInterviewIdsToDrop, planArchiveTargets, archiveCareerPatch, isCareerJobOwner } from "@/lib/utils/careerArchive";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { id, dropCandidates } = await request.json();
    if (!id) return NextResponse.json({ error: "Career ID is required" }, { status: 400 });

    const { db } = await connectMongoDB();
    const career = await db.collection("careers").findOne({ _id: new ObjectId(id) });
    if (!career) return NextResponse.json({ error: "Career not found" }, { status: 404 });

    const userEmail = request.user?.email;
    if (!isCareerJobOwner(career, userEmail)) {
      return NextResponse.json({ error: "Only Job Owners can archive this career" }, { status: 403 });
    }

    // Cascade is single-level by design: the careers hierarchy is parent -> child
    // posts only (children never have their own children), so one parentCareerID
    // lookup collects the whole subtree.
    const orgID = career.orgID;
    const children = career.id
      ? await db.collection("careers").find({ orgID, parentCareerID: career.id }).toArray()
      : [];
    const targetIds = planArchiveTargets(career, children);
    const archiveBatchId = new ObjectId().toString();

    await db.collection("careers").bulkWrite(
      [career, ...children].map((c: any) => ({
        updateOne: { filter: { _id: c._id }, update: { $set: archiveCareerPatch(c, { batchId: archiveBatchId, by: userEmail }) } },
      }))
    );

    let droppedCount = 0;
    if (dropCandidates) {
      const careerStringIds = [career, ...children].map((c: any) => c.id).filter(Boolean);
      // Candidate "interview" docs carry their career's `id` as their own `id`
      // (see get-career-applicants getFilter: { id: careerID }). "Hired stage" is
      // the applicationStatus field, not a pipeline substage.
      const interviews = await db
        .collection("interviews")
        .find({ orgID, id: { $in: careerStringIds } })
        .project({ _id: 1, applicationStatus: 1 })
        .toArray();
      const idsToDrop = selectInterviewIdsToDrop<ObjectId>(interviews);
      if (idsToDrop.length > 0) {
        const res = await db.collection("interviews").updateMany(
          { _id: { $in: idsToDrop } },
          { $set: { applicationStatus: "Dropped", interviewStatus: "Dropped", droppedReason: "career_archived", archiveBatchId, updatedAt: new Date() } }
        );
        droppedCount = res.modifiedCount ?? idsToDrop.length;
      }
    }

    try {
      await logActivity({
        db,
        kind: "recruiter_archived_career",
        career: { _id: career._id, jobTitle: career.jobTitle, id: career.id },
        orgID,
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
      console.error("[archive-career] activity log failed:", e);
    }

    return NextResponse.json({
      success: true,
      archivedCount: targetIds.length,
      droppedCount,
      archiveBatchId,
    });
  } catch (error) {
    console.error("Error archiving career:", error);
    return NextResponse.json({ error: "Failed to archive career" }, { status: 500 });
  }
});
