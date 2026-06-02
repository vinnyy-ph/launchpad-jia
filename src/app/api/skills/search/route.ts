import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { COMMON_SKILLS } from "@/lib/utils/skillSuggestions";

const COLLECTION_NAME = "skills-library";

const normalizeSkillKey = (value: string) =>
  value.toLowerCase().replace(/\./g, "").trim();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const limitParam = searchParams.get("limit");

    const limitRaw = parseInt(limitParam || "10", 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 50)
      : 10;

    const normalizedQuery = normalizeSkillKey(query);

    if (!normalizedQuery) {
      return NextResponse.json({ skills: [] });
    }

    const { db } = await connectMongoDB();
    const collection = db.collection(COLLECTION_NAME);

    const existingCount = await collection.countDocuments();

    // If the skills-library has not been seeded yet, fall back to
    // filtering the hardcoded COMMON_SKILLS so search still works.
    if (existingCount === 0) {
      const fallbackSkills = COMMON_SKILLS.filter((skill) =>
        normalizeSkillKey(skill).includes(normalizedQuery),
      ).slice(0, limit);

      return NextResponse.json({ skills: fallbackSkills });
    }

    const cursor = collection
      .find(
        {
          isCommon: true,
          normalizedName: { $regex: normalizedQuery, $options: "i" },
        },
        {
          projection: { name: 1, order: 1 },
          sort: { order: 1 },
        } as any,
      )
      .limit(limit);

    const docs = await cursor.toArray();
    const skills = docs
      .map((doc: any) => (doc.name ?? "").toString())
      .filter((name: string) => !!name);

    return NextResponse.json({ skills });
  } catch (error) {
    console.error("Error searching skills:", error);
    return NextResponse.json(
      { error: "Failed to search skills" },
      { status: 500 },
    );
  }
}
