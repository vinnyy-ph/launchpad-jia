import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

const VALID_SOURCES = ["candidate", "employer"] as const;

type SkillSource = (typeof VALID_SOURCES)[number];

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const candidateEmail = searchParams.get("candidateEmail");
    const orgID = searchParams.get("orgID");
    const skillName = searchParams.get("skillName");

    if (!candidateEmail) {
      return NextResponse.json(
        { error: "candidateEmail parameter is required" },
        { status: 400 },
      );
    }

    if (!orgID) {
      return NextResponse.json(
        { error: "orgID parameter is required" },
        { status: 400 },
      );
    }

    const { db } = await connectMongoDB();

    const query: any = { candidateEmail, orgID };
    if (skillName) {
      query.skillName = skillName;
    }

    const cursor = db.collection("org-candidate-skills").find(query);
    const docs = await cursor.toArray();

    // Skills are populated via lazy AI extraction triggered by the tooltip
    // No regex-based backfill here - return empty if no skills exist

    const items = docs.map((doc: any) => ({
      skillName: doc.skillName,
      source: (VALID_SOURCES as readonly string[]).includes(doc.source)
        ? (doc.source as SkillSource)
        : ("candidate" as SkillSource),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching org candidate skills:", error);
    return NextResponse.json({ error: "Failed to fetch org candidate skills" }, { status: 500 });
  }
});
