import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { COMMON_SKILLS, RELATED_SKILLS } from "@/lib/utils/skillSuggestions";

const COLLECTION_NAME = "skills-library";

const normalizeSkillKey = (value: string) =>
  value.toLowerCase().replace(/\./g, "").trim();

export async function GET() {
  try {
    const { db } = await connectMongoDB();
    const collection = db.collection(COLLECTION_NAME);

    const existingCount = await collection.countDocuments();

    // Seed from hardcoded lists if the collection is empty
    if (existingCount === 0) {
      const now = new Date();

      const commonSet = new Set<string>(COMMON_SKILLS);
      const allBaseSkills = new Set<string>([...COMMON_SKILLS, ...Object.keys(RELATED_SKILLS)]);

      const bulkOps: any[] = [];
      let order = 0;

      // Seed common skills first, preserving current order
      for (const name of COMMON_SKILLS) {
        const relatedSkills = RELATED_SKILLS[name] || [];
        bulkOps.push({
          updateOne: {
            filter: { name },
            update: {
              $setOnInsert: {
                name,
                normalizedName: normalizeSkillKey(name),
                isCommon: true,
                order,
                createdAt: now,
              },
              $set: {
                relatedSkills,
                updatedAt: now,
              },
            },
            upsert: true,
          },
        });
        order += 1;
      }

      // Seed any additional base skills that only appear as keys in RELATED_SKILLS
      for (const name of Object.keys(RELATED_SKILLS)) {
        if (commonSet.has(name)) continue;
        const relatedSkills = RELATED_SKILLS[name] || [];
        bulkOps.push({
          updateOne: {
            filter: { name },
            update: {
              $setOnInsert: {
                name,
                normalizedName: normalizeSkillKey(name),
                isCommon: false,
                order,
                createdAt: now,
              },
              $set: {
                relatedSkills,
                updatedAt: now,
              },
            },
            upsert: true,
          },
        });
        order += 1;
      }

      if (bulkOps.length > 0) {
        await collection.bulkWrite(bulkOps, { ordered: false });
      }
    }

    // Build config from the collection
    const docs = await collection.find({}).sort({ order: 1 }).toArray();

    const common: string[] = [];
    const related: { [key: string]: string[] } = {};

    for (const doc of docs) {
      const name = (doc.name || "").toString();
      if (!name) continue;

      if (doc.isCommon) {
        common.push(name);
      }

      if (Array.isArray(doc.relatedSkills)) {
        related[name] = doc.relatedSkills.map((s: any) => (s ?? "").toString()).filter(Boolean);
      } else if (RELATED_SKILLS[name]) {
        // Fallback to hardcoded related skills if DB field is missing
        related[name] = RELATED_SKILLS[name];
      } else {
        related[name] = [];
      }
    }

    return NextResponse.json({ common, related });
  } catch (error) {
    console.error("Error loading skills config:", error);
    return NextResponse.json(
      { error: "Failed to load skills config" },
      { status: 500 },
    );
  }
}
