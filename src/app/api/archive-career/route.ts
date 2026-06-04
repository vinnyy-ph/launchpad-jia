import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { logActivity } from "@/lib/utils/activityLogger";
import { resolveHiredSubstageId, selectInterviewIdsToDrop, planArchiveTargets } from "@/lib/utils/careerArchive";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { id, dropCandidates } = await request.json();
    if (!id) return NextResponse.json({ error: "Career ID is required" }, { status: 400 });

    const { db } = await connectMongoDB();
    const career = await db.collection("careers").findOne({ _id: new ObjectId(id) });
    if (!career) return NextResponse.json({ error: "Career not found" }, { status: 404 });

    const userEmail = request.user?.email;
    const isJobOwner = career.teamMembers?.some(
      (m: any) => m.email === userEmail && m.role === "Job Owner"
    );
    if (!isJobOwner) {
      return NextResponse.json({ error: "Only Job Owners can archive this career" }, { status: 403 });
    }

    const orgID = career.orgID;
    const children = career.id
      ? await db.collection("careers").find({ orgID, parentCareerID: career.id }).toArray()
      : [];
    const targetIds = planArchiveTargets(career, children);

    const archivePatch = {
      archived: true,
      archivedAt: new Date(),
      archivedBy: userEmail,
      status: "inactive",
      activityStatus: "Inactive",
      updatedAt: new Date(),
    };
    await db.collection("careers").updateMany({ _id: { $in: targetIds } }, { $set: archivePatch });

    let droppedCount = 0;
    if (dropCandidates) {
      const careerStringIds = [career, ...children].map((c: any) => c.id).filter(Boolean);
      const interviews = await db
        .collection("interviews")
        .find({ orgID, careerId: { $in: careerStringIds } })
        .toArray();
      // Group by career (pipelines differ per career), reuse the tested helper per group.
      const idsToDrop: any[] = [];
      for (const c of [career, ...children] as any[]) {
        if (!c.id) continue;
        const hiredId = resolveHiredSubstageId(c.pipelineStages);
        const careerInterviews = interviews.filter((iv: any) => iv.careerId === c.id);
        idsToDrop.push(...selectInterviewIdsToDrop(careerInterviews, hiredId));
      }
      if (idsToDrop.length > 0) {
        const res = await db.collection("interviews").updateMany(
          { _id: { $in: idsToDrop } },
          { $set: { applicationStatus: "Dropped", interviewStatus: "Dropped", droppedReason: "career_archived", updatedAt: new Date() } }
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
    });
  } catch (error) {
    console.error("Error archiving career:", error);
    return NextResponse.json({ error: "Failed to archive career" }, { status: 500 });
  }
});
