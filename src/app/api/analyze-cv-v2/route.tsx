import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import OpenAI from "openai";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import {
  hasStructuredQualifications,
  buildStructuredScreeningPrompt,
  parseStructuredAnalysis,
  type CvAnalysisV2,
} from "@/lib/utils/cvFitnessV2";

/**
 * V2 CV screening: buckets each structured qualification as matched / partial / missing.
 * Analysis-only — does NOT auto-promote the candidate or send emails (that stays in /api/screen-cv).
 * Falls back ({ fallback: true }) when the career has no structured qualifications, so legacy
 * careers keep using the V1 display.
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  // SECURITY: the request body's userEmail is deliberately ignored — the applicant email is
  // derived from the interview doc so an authenticated caller cannot run analysis against an
  // arbitrary applicant's CV. (V1 screen-cv/analyze-cv still accept it; base modules, untouched.)
  const { interviewID } = await request.json();
  const { db } = await connectMongoDB();

  const interviewData = await db.collection("interviews").findOne({ interviewID });
  if (!interviewData) {
    return NextResponse.json({ error: "No application found for the selected job." });
  }

  const careerDetails = await db.collection("careers").findOne({ id: interviewData.id });
  if (!hasStructuredQualifications(careerDetails)) {
    return NextResponse.json({ fallback: true });
  }

  const cvData = await db.collection("applicant-cv").findOne({ email: interviewData.email });
  if (!cvData) {
    return NextResponse.json({ error: "You have not uploaded a CV for this application." });
  }
  // A malformed applicant-cv doc (no digitalCV array) used to throw -> 500. Fail explicitly
  // instead of silently screening against an empty CV text.
  if (!Array.isArray(cvData.digitalCV)) {
    return NextResponse.json({ error: "CV data is missing or unreadable for this applicant." });
  }

  // Same flatten the V1 screen-cv route uses: digitalCV sections -> plain text for the prompt.
  let parsedCV = "";
  cvData.digitalCV.forEach((section: { name?: string; content?: string }) => {
    parsedCV += `${section.name}\n${section.content}\n`;
  });

  const promptDoc = await db
    .collection("global-settings")
    .findOne({ name: "global-settings" }, { projection: { cv_screening_prompt: 1 } });
  const basePrompt = promptDoc?.cv_screening_prompt?.prompt || "";
  const secretPrompt = careerDetails?.cvSecretPrompt || "";

  const prompt = buildStructuredScreeningPrompt(
    careerDetails.structuredDescription,
    parsedCV,
    interviewData.name,
    secretPrompt,
    basePrompt
  );

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let cvAnalysisV2: CvAnalysisV2;
  try {
    const completion = await openai.responses.create({
      model: "o4-mini",
      reasoning: { effort: "high" },
      input: [{ role: "user", content: prompt }],
    });
    cvAnalysisV2 = parseStructuredAnalysis(completion.output_text);
  } catch (error) {
    console.error("[analyze-cv-v2] generation failed:", error);
    return NextResponse.json({ error: "Failed to generate CV analysis. Please try again." });
  }

  await db
    .collection("interviews")
    .updateOne({ interviewID }, { $set: { cvAnalysisV2 } });

  await db.collection("recruiter-history").insertOne({
    interviewUID: interviewData._id.toString(),
    orgID: interviewData.orgID,
    action: "Generated CV Screening Result (V2)",
    recruiterEmail: request.user?.email,
    createdAt: Date.now(),
  });

  return NextResponse.json({ cvAnalysisV2 });
});
