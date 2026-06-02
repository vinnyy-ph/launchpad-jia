import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

const VALID_SOURCES = ["candidate", "employer"] as const;

type SkillSource = (typeof VALID_SOURCES)[number];

const MAX_SKILLS = 60;

const parseSkillsFromMarkdown = (markdownContent: string): string[] => {
  if (!markdownContent) return [];

  const sectionHeaders = [
    "skills",
    "technical skills",
    "soft skills",
    "hard skills",
    "core competencies",
    "expertise",
    "proficiencies",
    "technologies",
    "tools",
    "languages",
    "frameworks",
  ];

  const categoryHeaders = [
    "frontend",
    "back end",
    "backend",
    "full stack",
    "full-stack",
    "tools",
    "other",
    "stack",
    "tech stack",
    "technologies",
    "technology",
    "libraries",
    "frameworks",
    "platforms",
  ];

  const cleaned = String(markdownContent)
    .replace(/\r/g, "")
    .replace(/^[-*+•]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/[#*_~`]/g, "")
    .replace(/^>\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[•·]/g, ",")
    .trim();

  const parsed = [] as string[];

  for (const rawLine of cleaned.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    // Support category prefixes like: "Frontend: React, Next.js" or "Tools - Git, Linux"
    // We only strip prefixes when the label is short and looks like a category.
    const categoryMatch = line.match(/^\s*([^:]{1,30})\s*:\s*(.+)$/);
    const dashCategoryMatch = line.match(/^\s*([A-Za-z][A-Za-z\s\-/]{0,30})\s*[-–—]\s*(.+)$/);

    let remainder = line;
    if (categoryMatch) {
      const label = categoryMatch[1].trim().toLowerCase();
      if (categoryHeaders.includes(label) || sectionHeaders.includes(label)) {
        remainder = categoryMatch[2].trim();
      }
    } else if (dashCategoryMatch) {
      const label = dashCategoryMatch[1].trim().toLowerCase();
      if (categoryHeaders.includes(label) || sectionHeaders.includes(label)) {
        remainder = dashCategoryMatch[2].trim();
      }
    }

    for (const token of remainder.split(/[,;|\n]/)) {
      const skill = token.trim().replace(/^[-–—]\s*/, "");
      if (!skill) continue;

      const lowerSkill = skill.toLowerCase();

      // Drop obvious headers/categories accidentally treated as skills
      if (sectionHeaders.includes(lowerSkill)) continue;
      if (categoryHeaders.includes(lowerSkill)) continue;
      if (lowerSkill.endsWith(":")) continue;
      if (skill.length < 2) continue;
      if (/^[^a-zA-Z0-9]+$/.test(skill)) continue;

      parsed.push(skill);
    }
  }

  const seen = new Set<string>();
  const unique = [] as string[];
  for (const skill of parsed) {
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(skill);
    if (unique.length >= MAX_SKILLS) break;
  }

  return unique;
};

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const candidateEmail = request.user?.email;
    const skillName = searchParams.get("skillName");

    if (!candidateEmail) {
      return NextResponse.json(
        { error: "candidateEmail parameter is required" },
        { status: 400 },
      );
    }

    const { db } = await connectMongoDB();

    const query: any = { candidateEmail };
    if (skillName) {
      query.skillName = skillName;
    }

    const cursor = db.collection("candidate-skills").find(query);
    const docs = await cursor.toArray();

    if (docs.length === 0 && !skillName && request.user?.email === candidateEmail) {
      const cv = await db.collection("applicant-cv").findOne({ email: candidateEmail });
      const digitalCV = Array.isArray((cv as any)?.digitalCV) ? (cv as any).digitalCV : [];
      const skillsSection = digitalCV.find((section: any) => section?.name === "Skills");
      const skillsMarkdown = typeof skillsSection?.content === "string" ? skillsSection.content : "";
      const parsedSkills = parseSkillsFromMarkdown(skillsMarkdown);

      if (parsedSkills.length > 0) {
        const createdByEmail = request.user?.email || null;
        const createdById = request.user?.uid || null;
        const now = new Date();

        await db.collection("candidate-skills").deleteMany({
          candidateEmail,
          source: "candidate",
        });

        for (const skillName of parsedSkills) {
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
                source: "candidate",
                updatedAt: now,
              },
            },
            { upsert: true },
          );
        }
      }

      const refreshedDocs = await db.collection("candidate-skills").find({ candidateEmail }).toArray();
      const items = refreshedDocs.map((doc: any) => ({
        skillName: doc.skillName,
        source: (VALID_SOURCES as readonly string[]).includes(doc.source)
          ? (doc.source as SkillSource)
          : ("candidate" as SkillSource),
      }));

      return NextResponse.json({ items });
    }

    const items = docs.map((doc: any) => ({
      skillName: doc.skillName,
      source: (VALID_SOURCES as readonly string[]).includes(doc.source)
        ? (doc.source as SkillSource)
        : ("candidate" as SkillSource),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching candidate skill:", error);
    return NextResponse.json({ error: "Failed to fetch candidate skill" }, { status: 500 });
  }
});
