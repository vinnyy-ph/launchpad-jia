import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

const VALID_SOURCES = ["candidate", "employer"] as const;

type SkillSource = (typeof VALID_SOURCES)[number];

interface SyncOrgCandidateSkillsBody {
  candidateEmail: string;
  orgID: string;
  addedSkills?: string[];
  removedSkills?: string[];
  source?: SkillSource;
  wipeCandidateSource?: boolean;
}

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = (await request.json()) as Partial<SyncOrgCandidateSkillsBody>;
    const candidateEmail = body.candidateEmail?.trim();
    const orgID = body.orgID?.trim();

    const addedSkills = Array.isArray(body.addedSkills)
      ? body.addedSkills.map((s) => s?.trim()).filter(Boolean)
      : [];

    const removedSkills = Array.isArray(body.removedSkills)
      ? body.removedSkills.map((s) => s?.trim()).filter(Boolean)
      : [];

    const source: SkillSource = (body.source && VALID_SOURCES.includes(body.source))
      ? body.source
      : "employer";

    const wipeCandidateSource = body.wipeCandidateSource === true;

    if (!candidateEmail) {
      return NextResponse.json(
        { error: "candidateEmail is required" },
        { status: 400 },
      );
    }

    if (!orgID) {
      return NextResponse.json(
        { error: "orgID is required" },
        { status: 400 },
      );
    }

    if (addedSkills.length === 0 && removedSkills.length === 0) {
      return NextResponse.json({ message: "No skill changes to apply" });
    }

    const { db } = await connectMongoDB();

    const createdByEmail = request.user?.email || null;
    const createdById = request.user?.uid || null;
    const now = new Date();

    let removedCount = 0;

    // Optionally wipe out candidate-sourced skills for this org before applying new ones.
    // This is used when a candidate re-uploads a CV so stale skills don't linger.
    if (wipeCandidateSource && source === "candidate") {
      await db.collection("org-candidate-skills").deleteMany({
        candidateEmail,
        orgID,
        $or: [{ source: "candidate" }, { source: { $exists: false } }],
      });
    }

    // Apply removals
    if (removedSkills.length > 0) {
      const deleteResult = await db
        .collection("org-candidate-skills")
        .deleteMany({
          candidateEmail,
          orgID,
          skillName: { $in: removedSkills },
        });

      removedCount = deleteResult.deletedCount ?? 0;
    }

    // Apply additions (upsert skills)
    for (const skillName of addedSkills) {
      await db.collection("org-candidate-skills").updateOne(
        { candidateEmail, orgID, skillName },
        {
          $setOnInsert: {
            candidateEmail,
            orgID,
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
      message: "Org candidate skills synced successfully",
      addedCount: addedSkills.length,
      removedCount,
    });
  } catch (error) {
    console.error("Error syncing org candidate skills:", error);
    return NextResponse.json(
      { error: "Failed to sync org candidate skills" },
      { status: 500 },
    );
  }
});
