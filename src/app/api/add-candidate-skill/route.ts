import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

const VALID_SOURCES = ["candidate", "employer"] as const;

type SkillSource = (typeof VALID_SOURCES)[number];

interface UpsertSkillMetadataBody {
  candidateEmail: string;
  skillName: string;
  source: SkillSource;
}

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = (await request.json()) as Partial<UpsertSkillMetadataBody>;
    const candidateEmail = body.candidateEmail?.trim();
    const skillName = body.skillName?.trim();
    const source = body.source;

    if (!candidateEmail || !skillName || !source || !VALID_SOURCES.includes(source)) {
      console.error("[add-candidate-skill] Missing required data: candidateEmail, skillName, or source");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 },
      );
    }

    const { db } = await connectMongoDB();

    const createdByEmail = request.user?.email || null;
    const createdById = request.user?.uid || null;

    const now = new Date();

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

    return NextResponse.json({ message: "Candidate skill saved successfully" });
  } catch (error) {
    console.error("Error saving candidate skill:", error);
    return NextResponse.json({ error: "Failed to save candidate skill" }, { status: 500 });
  }
});
