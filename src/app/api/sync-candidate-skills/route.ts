import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

const VALID_SOURCES = ["candidate", "employer"] as const;

type SkillSource = (typeof VALID_SOURCES)[number];

interface SyncCandidateSkillsBody {
  candidateEmail: string;
  addedSkills?: string[];
  removedSkills?: string[];
  source?: SkillSource;
  wipeCandidateSource?: boolean;
}

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = (await request.json()) as Partial<SyncCandidateSkillsBody>;
    const candidateEmail = body.candidateEmail?.trim();
    const authUserEmail = request.user?.email;

    const addedSkills = Array.isArray(body.addedSkills)
      ? body.addedSkills.map((s) => s?.trim()).filter(Boolean)
      : [];

    const removedSkills = Array.isArray(body.removedSkills)
      ? body.removedSkills.map((s) => s?.trim()).filter(Boolean)
      : [];

    const source: SkillSource = (body.source && VALID_SOURCES.includes(body.source))
      ? body.source
      : "candidate";

    const wipeCandidateSource = body.wipeCandidateSource === true;

    if (!candidateEmail) {
      return NextResponse.json(
        { error: "candidateEmail is required" },
        { status: 400 },
      );
    }

    if (!wipeCandidateSource && addedSkills.length === 0 && removedSkills.length === 0) {
      return NextResponse.json({ message: "No skill changes to apply" });
    }

    const { db } = await connectMongoDB();


    if (authUserEmail !== candidateEmail) {
      // Check if auth user is a recruiter
      const recruiterDetails = await db.collection("members").findOne({
        email: authUserEmail,
        role: { $in: ["admin", "super_admin", "recruiter", "hiring_manager"] },
      });
      
      if (!recruiterDetails) {
        return NextResponse.json({ error: "You are not authorized to sync candidate skills" }, { status: 403 });
      }
    }

    const createdByEmail = request.user?.email || null;
    const createdById = request.user?.uid || null;
    const now = new Date();

    let endorsementsDeleted = 0;
    let metadataDeleted = 0;

    // 1) If requested, wipe all existing candidate-sourced skills before inserting new ones
    if (wipeCandidateSource && source === "candidate") {
      const existingCandidateDocs = await db
        .collection("candidate-skills")
        .find({ candidateEmail, source: "candidate" })
        .toArray();

      const existingSkillNames = existingCandidateDocs
        .map((doc: any) => (doc.skillName || "").toString().trim())
        .filter((name: string) => !!name);

      if (existingSkillNames.length > 0) {
        const deleteQuery = {
          candidateEmail,
          skillName: { $in: existingSkillNames },
        } as const;

        const endorsementsDeleteResult = await db
          .collection("skill-endorsements")
          .deleteMany(deleteQuery);

        const metadataDeleteResult = await db
          .collection("candidate-skills")
          .deleteMany(deleteQuery);

        endorsementsDeleted += endorsementsDeleteResult.deletedCount ?? 0;
        metadataDeleted += metadataDeleteResult.deletedCount ?? 0;
      }
    }

    // 2) Apply explicit removals (used by diff-based updates)
    if (removedSkills.length > 0 && !wipeCandidateSource) {
      const deleteQuery = {
        candidateEmail,
        skillName: { $in: removedSkills },
      } as const;

      const endorsementsDeleteResult = await db
        .collection("skill-endorsements")
        .deleteMany(deleteQuery);

      const metadataDeleteResult = await db
        .collection("candidate-skills")
        .deleteMany(deleteQuery);

      endorsementsDeleted += endorsementsDeleteResult.deletedCount ?? 0;
      metadataDeleted += metadataDeleteResult.deletedCount ?? 0;
    }

    // 3) Upsert skills (one DB op per skill, but single HTTP request)
    for (const skillName of addedSkills) {
      await db.collection("candidate-skills").updateOne(
        { candidateEmail, skillName },
        {
          $setOnInsert: {
            candidateEmail,
            skillName,
            createdByEmail,
            createdById,
            createdAt: now,
          },
          $set: {
            source,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    }

    return NextResponse.json({
      message: "Candidate skills synced successfully",
      addedCount: addedSkills.length,
      removedCount: removedSkills.length,
      endorsementsDeleted,
      metadataDeleted,
    });
  } catch (error) {
    console.error("Error syncing candidate skills:", error);
    return NextResponse.json(
      { error: "Failed to sync candidate skills" },
      { status: 500 },
    );
  }
});
