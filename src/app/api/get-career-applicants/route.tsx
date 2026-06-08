import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { getCurrentPipelineStage } from "@/lib/Utils";
import { DEFAULT_JOB_PIPELINE } from "../../../lib/utils/constants";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { ensureCareerFetchIndexes } from "@/lib/utils/ensureIndexes";
import { getApplicantsFilter, getApplicantsSort, buildApplicantsPipeline } from "@/lib/utils/careerFetchPipelines";

/**
 * [Bonus: Optimize fetching] This route was averaging 4.7–12.5s on careers with
 * 1k–3k applicants. Two fixes (see OPTIMIZE_FETCHING.md for measurements):
 *  1. ensureCareerFetchIndexes — the interviews.id match and the
 *     recruiter-evaluations lookup now hit indexes instead of collection scans.
 *  2. buildApplicantsPipeline — $sort/$skip/$limit moved BEFORE the
 *     recruiter-evaluations $lookup, so only the returned page (default 10 docs)
 *     is joined instead of every applicant on the career.
 * Response shape is unchanged.
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { db } = await connectMongoDB();
  await ensureCareerFetchIndexes(db);
  const { searchParams } = new URL(request.url);
  const careerID = searchParams.get("careerID");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const search = searchParams.get("search");
  const filterStageId = searchParams.get("filterStageId");
  const filterSubstageId = searchParams.get("filterSubstageId");
  const filterStatus = searchParams.get("filterStatus");
  const sortBy = searchParams.get("sortBy");
  try {
    const filter = getApplicantsFilter(careerID, search, filterStageId, filterSubstageId, filterStatus);
    const sort = getApplicantsSort(sortBy);
    const applicants = await db
      .collection("interviews")
      .aggregate(buildApplicantsPipeline({ filter, sort, page, limit }))
      .toArray();
    const totalApplicants = await db.collection("interviews").countDocuments(filter);
    const totalPages = Math.ceil(totalApplicants / limit);
    const career = await db.collection("careers").findOne({ id: careerID });
    const pipelineStages = career?.pipelineStages || DEFAULT_JOB_PIPELINE;

    return NextResponse.json({
      applicants: applicants.map((a) => {
        let currentStage = getCurrentPipelineStage(pipelineStages, { status: a.status, currentStep: a.currentStep });

        // Flexible fallback: If utility failed (null), try matching by ID directly here
        if (!currentStage && a.stageId) {
          const matchedStage = pipelineStages.find((s: any) => s.id === a.stageId);
          if (matchedStage) {
            const matchedSubstage = matchedStage.substages?.find((s: any) => s.id === a.substageId) || matchedStage.substages?.[0];
            if (matchedSubstage) {
              currentStage = {
                stage: { id: matchedStage.id, name: matchedStage.name },
                substage: matchedSubstage
              };
            }
          }
        }

        return {
          ...a,
          stage: currentStage
            ? `${currentStage.stage.name} - ${currentStage.substage.name}`
            : `${a.currentStep || 'Unknown'} - ${a.status || 'Unknown'}`,
        }
      }), totalPages, totalApplicants
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch applicants" }, { status: 500 });
  }
});