import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { extractContactFieldsFromTextWithAi } from "@/lib/utils/cvContactFieldAiExtractor";

// In-memory set to track in-flight extractions by email
const inFlightExtractions = new Set<string>();

type ExtractRequestBody = {
  email: string;
  orgID?: string;
};

const buildResumeText = (digitalCV: any): string => {
  const sections = Array.isArray(digitalCV) ? digitalCV : [];
  const joined = sections
    .map((s: any) => `${String(s?.name ?? "")}\n${String(s?.content ?? "")}`)
    .join("\n\n")
    .trim();

  const maxChars = 12000;
  return joined.length > maxChars ? joined.slice(0, maxChars) : joined;
};

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const body = (await request.json()) as ExtractRequestBody;
  const email = body?.email?.trim();
  const orgID = body?.orgID?.trim() || null;

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Deduplication: skip if extraction already in-flight for this email
  if (inFlightExtractions.has(email)) {
    return NextResponse.json({
      skipped: true,
      reason: "extraction_in_progress",
    });
  }

  // Check OpenAI API key
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const { db } = await connectMongoDB();

  // Fetch the applicant-cv document
  const cvDoc = await db.collection("applicant-cv").findOne(
    { email },
    {
      projection: {
        _id: 1,
        email: 1,
        digitalCV: 1,
        phone: 1,
        currentPosition: 1,
        company: 1,
        location: 1,
        contactFieldsExtractedAt: 1,
      },
    }
  );

  if (!cvDoc) {
    return NextResponse.json({ error: "CV not found" }, { status: 404 });
  }

  // Check if any fields are missing
  const existingPhone = cvDoc.phone?.trim() || null;
  const existingPosition = cvDoc.currentPosition?.trim() || null;
  const existingCompany = cvDoc.company?.trim() || null;
  const existingLocation = cvDoc.location?.trim() || null;

  // Check if skills exist in org-candidate-skills (only if orgID provided)
  let existingSkillsCount = 0;
  if (orgID) {
    existingSkillsCount = await db.collection("org-candidate-skills").countDocuments({
      candidateEmail: email,
      orgID,
    });
  }

  const missingFields: string[] = [];
  if (!existingPhone) missingFields.push("phone");
  if (!existingPosition) missingFields.push("currentPosition");
  if (!existingCompany) missingFields.push("company");
  if (!existingLocation) missingFields.push("location");
  if (orgID && existingSkillsCount === 0) missingFields.push("skills");

  // If all fields present, return early
  if (missingFields.length === 0) {
    return NextResponse.json({
      skipped: true,
      reason: "all_fields_present",
    });
  }

  // Check if digitalCV exists
  const digitalCV = cvDoc.digitalCV;
  if (!Array.isArray(digitalCV) || digitalCV.length === 0) {
    return NextResponse.json({
      skipped: true,
      reason: "no_digital_cv",
    });
  }

  const resumeText = buildResumeText(digitalCV);
  if (!resumeText) {
    return NextResponse.json({
      skipped: true,
      reason: "empty_resume_text",
    });
  }

  // Mark extraction as in-flight
  inFlightExtractions.add(email);

  try {
    // Call AI extractor
    const { fields } = await extractContactFieldsFromTextWithAi(resumeText);

    // Build update object for only missing fields
    const updateSet: Record<string, any> = {};

    if (!existingPhone && fields.phone) {
      updateSet.phone = fields.phone;
    }
    if (!existingPosition && fields.currentPosition) {
      updateSet.currentPosition = fields.currentPosition;
    }
    if (!existingCompany && fields.company) {
      updateSet.company = fields.company;
    }
    if (!existingLocation && fields.location) {
      updateSet.location = fields.location;
    }

    // Add provenance metadata
    if (Object.keys(updateSet).length > 0) {
      updateSet.contactFieldsExtractedAt = new Date();
      updateSet.contactFieldsExtractionSource = "lazy";
      updateSet.updatedAt = Date.now();

      await db.collection("applicant-cv").updateOne(
        { _id: cvDoc._id },
        { $set: updateSet }
      );
    }

    // Insert skills into org-candidate-skills if orgID provided and skills extracted
    let insertedSkillsCount = 0;
    if (orgID && fields.skills.length > 0 && existingSkillsCount === 0) {
      const now = new Date();
      const skillDocs = fields.skills.map((skillName) => ({
        candidateEmail: email,
        orgID,
        skillName,
        createdAt: now,
        updatedAt: now,
      }));

      try {
        const result = await db.collection("org-candidate-skills").insertMany(skillDocs, { ordered: false });
        insertedSkillsCount = result.insertedCount;
      } catch (insertError: any) {
        // Ignore duplicate key errors (skills already exist)
        if (insertError?.code !== 11000) {
          console.error("Failed to insert skills:", insertError?.message);
        }
      }
    }

    return NextResponse.json({
      extracted: true,
      missingFields,
      updatedFields: Object.keys(updateSet).filter(
        (k) => !["contactFieldsExtractedAt", "contactFieldsExtractionSource", "updatedAt"].includes(k)
      ),
      fields: {
        phone: updateSet.phone || existingPhone,
        currentPosition: updateSet.currentPosition || existingPosition,
        company: updateSet.company || existingCompany,
        location: updateSet.location || existingLocation,
      },
      skills: {
        extracted: fields.skills,
        insertedCount: insertedSkillsCount,
      },
    });
  } catch (error: any) {
    console.error("Lazy CV field extraction failed:", error?.message || error);
    return NextResponse.json(
      { error: "Extraction failed", message: error?.message },
      { status: 500 }
    );
  } finally {
    // Always remove from in-flight set
    inFlightExtractions.delete(email);
  }
});

