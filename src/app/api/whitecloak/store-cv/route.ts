import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import {
  buildLegacyDigitalCVFromStructuredCV,
  normalizeLegacyDigitalCVSections,
} from "@/lib/utils/digitalCVLegacy";
import { logActivity } from "@/lib/utils/activityLogger";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { cvData, email, fileInfo, name } = await request.json();
  const { db } = await connectMongoDB();

  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!normalizedEmail) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const existingCV = await db.collection("applicant-cv").findOne({
    email: normalizedEmail,
  });

  const existingVerifiedPhone = `${existingCV?.structuredCV?.contactInfo?.phone || ""}`.trim();
  const hasExistingVerifiedPhone =
    existingCV?.structuredCV?.contactInfo?.isPhoneVerified === true &&
    existingVerifiedPhone.length > 0;

  const incomingStructuredCV =
    cvData?.structuredCV && typeof cvData.structuredCV === "object"
      ? cvData.structuredCV
      : null;
  const incomingContactInfo =
    incomingStructuredCV?.contactInfo && typeof incomingStructuredCV.contactInfo === "object"
      ? incomingStructuredCV.contactInfo
      : null;
  const incomingPhone = `${incomingContactInfo?.phone || ""}`.trim();
  const shouldPreserveExistingVerifiedPhone = hasExistingVerifiedPhone;

  const mergedStructuredCV =
    incomingStructuredCV && shouldPreserveExistingVerifiedPhone
      ? {
          ...incomingStructuredCV,
          contactInfo: {
            ...(incomingStructuredCV.contactInfo || {}),
            phone: existingVerifiedPhone,
            isPhoneVerified: true,
          },
        }
      : incomingStructuredCV;

  const payload = {
    email: normalizedEmail,
    name: typeof name === "string" ? name : "",
    fileInfo: fileInfo ?? null,
    errorRemarks: cvData?.errorRemarks ?? null,
    digitalCV:
      mergedStructuredCV && typeof mergedStructuredCV === "object"
        ? buildLegacyDigitalCVFromStructuredCV(mergedStructuredCV, cvData?.digitalCV)
        : normalizeLegacyDigitalCVSections(cvData?.digitalCV),
    structuredCV:
      mergedStructuredCV && typeof mergedStructuredCV === "object"
        ? mergedStructuredCV
        : null,
    numExperience: cvData?.numExperience ?? null,
    phone:
      `${mergedStructuredCV?.contactInfo?.phone || ""}`.trim() ||
      (shouldPreserveExistingVerifiedPhone ? existingVerifiedPhone : cvData?.phone ?? null),
    location: cvData?.location ?? null,
    currentPosition: cvData?.currentPosition ?? null,
    company: cvData?.company ?? null,
    updatedAt: Date.now(),
  };

  await db.collection("applicant-cv").updateOne(
    { email: normalizedEmail },
    {
      $set: payload,
      $setOnInsert: {
        createdAt: Date.now(),
      },
    },
    { upsert: true }
  );

  const skillsSection = Array.isArray(payload.digitalCV)
    ? payload.digitalCV.find((section: any) => section?.name === "Skills")
    : null;
  const skillsContent =
    typeof skillsSection?.content === "string" ? skillsSection.content : "";

  let skills: string[] = [];
  try {
    const parsed = JSON.parse(skillsContent);
    if (Array.isArray(parsed)) {
      skills = parsed
        .filter((s) => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim());
    } else {
      throw new Error("not array");
    }
  } catch {
    skills = skillsContent
      .split("\n")
      .map((line: string) => line.trim().replace(/^[-*+•]\s*/, ""))
      .filter((line: string) => line.length > 0)
      .filter((line: string) => line.toLowerCase() !== "skills")
      .slice(0, 60);
  }

  if (skills.length > 0) {
    await db.collection("candidate-skills").deleteMany({
      candidateEmail: normalizedEmail,
      source: "candidate",
    });

    const now = new Date();
    for (const skillName of skills) {
      await db.collection("candidate-skills").updateOne(
        { candidateEmail: normalizedEmail, skillName },
        {
          $setOnInsert: {
            candidateEmail: normalizedEmail,
            skillName,
            createdByEmail: request.user?.email || null,
            createdById: request.user?.uid || null,
            createdAt: now,
          },
          $set: {
            source: "candidate",
            updatedAt: now,
          },
        },
        { upsert: true }
      );
    }
  }

  // Track CV submission in activity history for each related application
  try {
    const applicantEmail = normalizedEmail || request.user?.email;
    const applicantName =
      (typeof payload.name === "string" && payload.name.trim()) ||
      request.user?.name ||
      (typeof applicantEmail === "string" ? applicantEmail.split("@")[0] : "Applicant");

    if (applicantEmail) {
      const relatedInterviews = await db
        .collection("interviews")
        .find({ email: applicantEmail })
        .toArray();

      const interviewCareerIds = Array.from(
        new Set(
          relatedInterviews
            .map((interview: any) => interview?.id)
            .filter((id: any) => typeof id === "string" && id.trim())
        )
      );

      const careers = interviewCareerIds.length
        ? await db.collection("careers").find({ id: { $in: interviewCareerIds as string[] } }).toArray()
        : [];

      for (const interview of relatedInterviews) {
        if (!interview?.orgID || !interview?._id) {
          continue;
        }
        // Only log "Submitted CV" for this role when the candidate's status for this career is "For CV Screening"
        if (interview.status !== "For CV Screening") {
          continue;
        }

        const matchedCareer = careers.find((career: any) => career?.id === interview?.id);

        await logActivity({
          db,
          kind: "candidate_submitted_cv",
          interview,
          career: matchedCareer,
          actor: {
            type: "candidate",
            email: applicantEmail,
            name: applicantName,
          },
        });
      }
    }
  } catch (error) {
    console.error("Failed to track CV submission activity:", error);
  }

  return NextResponse.json({ message: "CV stored successfully" });
});
