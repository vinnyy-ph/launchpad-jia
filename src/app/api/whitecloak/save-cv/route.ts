// TODO (Vince) - For Merging

import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { logActivity } from "@/lib/utils/activityLogger";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { cvData, email, fileInfo, name, numExperience } = await request.json();
  const { db } = await connectMongoDB();

  const digitalCV = Array.isArray(cvData?.digitalCV) ? cvData.digitalCV : [];

  const normalizeNullableString = (value: unknown): string | null => {
    if (value == null) return null;
    if (typeof value !== "string") return null;
    const s = value.trim();
    return s ? s : null;
  };

  // Extract fields from AI response, with fallback to manual parsing if needed
  let extractedPhone: string | null = normalizeNullableString(cvData?.phone);
  let extractedLocation: string | null = normalizeNullableString(cvData?.location);
  let extractedCurrentPosition: string | null = normalizeNullableString(cvData?.currentPosition);
  let extractedCompany: string | null = normalizeNullableString(cvData?.company);

  // Fallback: Manual parsing if AI extraction didn't provide values
  const contactSection = digitalCV.find((section: any) => section?.name === "Contact Info");
  const currentPositionSection = digitalCV.find((section: any) => section?.name === "Current Position");

  // Parse experience from content looking for explicit "X years" or "X months" patterns
  const parseExperienceFromContent = (experienceContent: unknown): string | null => {
    if (experienceContent == null) return null;
    const raw = String(experienceContent).trim().toLowerCase();
    if (!raw) return null;

    // Look for explicit patterns like "3 years", "1.5 years", "10 months"
    // This avoids matching years like "2019" from date ranges
    const yearsMatch = raw.match(/(\d+(?:\.\d+)?)\s*years?\b/);
    const monthsMatch = raw.match(/(\d+(?:\.\d+)?)\s*months?\b/);

    if (yearsMatch) {
      const value = Number(yearsMatch[1]);
      if (Number.isFinite(value) && value >= 0) {
        return value === 1 ? "1 year" : `${value} years`;
      }
    }

    if (monthsMatch) {
      const value = Number(monthsMatch[1]);
      if (Number.isFinite(value) && value >= 0) {
        return value === 1 ? "1 month" : `${value} months`;
      }
    }

    return null;
  };

  // Parse numExperience from string format like "1.5 years", "10 months", or number
  const getValidatedNumExperience = (): string | null => {
    const candidate = (numExperience ?? cvData?.numExperience) as unknown;
    if (candidate == null) return null;

    // If it's already a number, convert to string format
    if (typeof candidate === "number") {
      if (!Number.isFinite(candidate) || candidate < 0) return null;
      return candidate === 1 ? "1 year" : `${candidate} years`;
    }

    // Parse string format like "1.5 years", "1 year", "10 months"
    const raw = String(candidate).trim().toLowerCase();
    if (!raw) return null;

    const yearsMatch = raw.match(/^(\d+(?:\.\d+)?)\s*years?$/);
    const monthsMatch = raw.match(/^(\d+(?:\.\d+)?)\s*months?$/);

    if (yearsMatch) {
      const value = Number(yearsMatch[1]);
      if (Number.isFinite(value) && value >= 0) {
        return value === 1 ? "1 year" : `${value} years`;
      }
    }

    if (monthsMatch) {
      const value = Number(monthsMatch[1]);
      if (Number.isFinite(value) && value >= 0) {
        return value === 1 ? "1 month" : `${value} months`;
      }
    }

    // Try parsing as plain number (backwards compatibility)
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) {
      return n === 1 ? "1 year" : `${n} years`;
    }

    return null;
  };

  const experienceSection = digitalCV.find((section: any) => section?.name === "Experience");
  const derivedNumExperience = parseExperienceFromContent(experienceSection?.content);
  const finalNumExperience = getValidatedNumExperience() ?? derivedNumExperience;

  // Helper to clean contact section content
  const getCleanedContactContent = (): string | null => {
    if (!contactSection?.content) return null;
    return String(contactSection.content)
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      .trim();
  };

  // Fallback: Phone parsing only if AI extraction didn't provide value
  if (!extractedPhone && contactSection?.content) {
    const cleanContent = getCleanedContactContent();
    if (cleanContent) {
      const phonePatterns = [
        /Phone[:\s]*([+\d\s\-()\.]+)/i,
        /Mobile[:\s]*([+\d\s\-()\.]+)/i,
        /Tel[:\s]*([+\d\s\-()\.]+)/i,
        /Contact[:\s]*([+\d\s\-()\.]+)/i,
        /(\+\d{1,3}[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{4})/,
        /(\d{4}[\s\-]?\d{3}[\s\-]?\d{4})/,
        /(\(\d{3}\)[\s\-]?\d{3}[\s\-]?\d{4})/,
        /(\d{11})/,
      ];

      for (const pattern of phonePatterns) {
        const match = cleanContent.match(pattern);
        if (match && match[1]) {
          extractedPhone = match[1].trim();
          break;
        }
      }
    }
  }

  // Fallback: Location parsing only if AI extraction didn't provide value (separate from phone)
  if (!extractedLocation && contactSection?.content) {
    const cleanContent = getCleanedContactContent();
    if (cleanContent) {
      const locationPatterns = [
        /Address[:\s]*([^\n\r]+)/i,
        /Location[:\s]*([^\n\r]+)/i,
        /City[:\s]*([^\n\r]+)/i,
        /([A-Za-z\s]+,\s*[A-Za-z\s]+(?:,\s*[A-Za-z\s]+)*)/,
      ];

      for (const pattern of locationPatterns) {
        const match = cleanContent.match(pattern);
        if (match && match[1]) {
          const candidateLocation = match[1]
            .trim()
            .replace(/\*\*/g, "")
            .replace(/\*/g, "")
            .replace(/^\s*[-*+]\s*/, "");

          // Don't treat LinkedIn or URL lines as a location
          if (/linkedin|http[s]?:\/\/|www\./i.test(candidateLocation)) {
            continue;
          }

          extractedLocation = candidateLocation;
          break;
        }
      }
    }
  }

  if (!extractedCurrentPosition && currentPositionSection?.content) {
    const cleanedPosition = String(currentPositionSection.content)
      .replace(/\*\*/g, "")
      .replace(/[\*`_~]/g, "")
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      .trim();

    if (cleanedPosition) {
      extractedCurrentPosition = cleanedPosition;

      // Try to split "Role at Company" into separate fields
      const companyMatch = cleanedPosition.match(/(.+)\s+at\s+(.+)/i);
      if (companyMatch) {
        extractedCurrentPosition = companyMatch[1].trim();
        if (!extractedCompany) {
          extractedCompany = companyMatch[2].trim();
        }
      }
    }
  }

  await db.collection("applicant-cv").updateOne(
    {
      email,
    },
    {
      $set: {
        digitalCV: cvData.digitalCV,
        errorRemarks: cvData.errorRemarks,
        fileInfo,
        name,
        numExperience: finalNumExperience ?? null,
        updatedAt: Date.now(),
        phone: extractedPhone,
        location: extractedLocation,
        currentPosition: extractedCurrentPosition,
        company: extractedCompany,
      },
    },
    { upsert: true }
  );

  // Track CV submission in activity history for each related application
  try {
    const applicantEmail = email || request.user?.email;
    const applicantName =
      name ||
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

  return NextResponse.json({
    message: "CV saved successfully",
  });
});
