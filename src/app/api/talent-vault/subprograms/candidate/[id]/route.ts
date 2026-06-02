import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, type AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { findTalentVaultProfile } from "@/app/(talent-vault)/lib/server/findTalentVaultProfile";
import { tvErrorResponse } from "@/app/api/talent-vault/lib/tvApiError";

const SUBPROGRAM_COLLECTION = "tv-subprograms";

/**
 * Maps subprogram document to candidate-safe response
 * Excludes secretPrompt and interview.interviewSecretPrompt
 * Includes boolean flags indicating presence of secret fields
 */
function mapSubprogramForCandidateResponse(subprogram: any) {
  // Extract safe pre-screening questions
  const preScreeningQuestions = Array.isArray(subprogram.preScreeningQuestions)
    ? subprogram.preScreeningQuestions.map((q: any) => ({
        id: q.id,
        questionType: q.questionType,
        question: q.question,
        questionFormat: q.questionFormat,
        answers: Array.isArray(q.answers)
          ? q.answers.map((a: any) => ({
              id: a.id,
              value: a.value,
              type: a.type,
            }))
          : [],
        ...(q.currencyCode && { currencyCode: q.currencyCode }),
      }))
    : [];

  // Extract safe interview data
  const interview =
    subprogram.interview && typeof subprogram.interview === "object"
      ? {
          questions: Array.isArray(subprogram.interview.questions)
            ? subprogram.interview.questions.map((group: any) => ({
                category: group.category,
                questionCountToAsk: group.questionCountToAsk,
                questions: Array.isArray(group.questions)
                  ? group.questions.map((q: any) => ({
                      question: q.question,
                    }))
                  : [],
              }))
            : [],
          aiInterviewLanguage: String(
            subprogram.interview.aiInterviewLanguage || "English"
          ).trim(),
          voice: subprogram.interview.voice || null,
          requireVideo: Boolean(subprogram.interview.requireVideo),
          walkthroughLanguage: String(
            subprogram.interview.walkthroughLanguage || "english"
          ).trim(),
        }
      : {
          questions: [],
          aiInterviewLanguage: "English",
          voice: null,
          requireVideo: true,
          walkthroughLanguage: "english",
        };

  return {
    _id: subprogram._id.toString(),
    title: String(subprogram.title || "").trim(),
    roleType: String(subprogram.roleType || "").trim(),
    preScreeningQuestions,
    interview,
    hasInterviewSecretPrompt: Boolean(
      subprogram.interview?.interviewSecretPrompt
    ),
    hasSummarySecretPrompt: Boolean(subprogram.secretPrompt),
  };
}

export const GET = withAuth(
  async (
    request: AuthenticatedRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await context.params;

      if (!id || !ObjectId.isValid(id)) {
        return tvErrorResponse(
          400,
          "SUBPROGRAM_ID_INVALID",
          "Invalid subprogram id."
        );
      }

      const { db } = await connectMongoDB();

      // Enforce candidate profile requirement
      const candidateProfile = await findTalentVaultProfile(db, {
        email: request.user.email,
      });

      if (!candidateProfile) {
        return tvErrorResponse(
          403,
          "CANDIDATE_PROFILE_REQUIRED",
          "Candidate profile is required to access this resource."
        );
      }

      const subprogramCollection = db.collection(SUBPROGRAM_COLLECTION);

      const subprogram = await subprogramCollection.findOne({
        _id: new ObjectId(id),
        status: "active",
        activityStatus: "Active",
        archivedAt: null,
      });

      if (!subprogram) {
        return tvErrorResponse(
          404,
          "SUBPROGRAM_NOT_FOUND_OR_INELIGIBLE",
          "Subprogram not found or not eligible."
        );
      }

      return NextResponse.json({
        subprogram: mapSubprogramForCandidateResponse(subprogram),
      });
    } catch (error) {
      console.error("Error fetching candidate subprogram detail:", error);
      return tvErrorResponse(
        500,
        "FETCH_SUBPROGRAM_DETAIL_FAILED",
        "Failed to fetch subprogram details."
      );
    }
  }
);
