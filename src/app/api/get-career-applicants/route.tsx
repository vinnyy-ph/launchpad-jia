import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { getCurrentPipelineStage } from "@/lib/Utils";
import { DEFAULT_JOB_PIPELINE } from "../../../lib/utils/constants";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";



export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { db } = await connectMongoDB();
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
    const filter = getFilter(careerID, search, filterStageId, filterSubstageId, filterStatus);
    const sort = getSort(sortBy);
    const applicants = await db.collection("interviews").aggregate([
      { $match: filter },
      {
        $project: {
          _id: 1,
          interviewID: 1,
          name: 1,
          image: 1,
          nameLower: {
            $toLower: "$name"
          },
          email: 1,
          applicationStatus: 1,
          currentStep: 1,
          status: 1,
          updatedAt: {
            $toDate: "$updatedAt"
          },
          createdAt: {
            $toDate: "$createdAt"
          },
          // Additional fields for fit status display (matching recruiter-dashboard)
          cvStatus: 1,
          jobFit: 1,
          cvScreeningEvaluation: 1,
          cvScreeningReason: 1,
          summary: 1,
          stageId: 1,
          substageId: 1,
        }
      },
      // Lookup recruiter evaluations to get currentEvaluation (endorser info, matchFit)
      {
        $lookup: {
          from: "recruiter-evaluations",
          let: {
            interviewUID: { $toString: "$_id" },
            status: {
              $cond: {
                if: { $ne: ["$applicationStatus", "Dropped"] },
                then: "Endorsed",
                else: "Dropped",
              },
            },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$interviewUID", "$$interviewUID"] },
                    { $eq: ["$action", "$$status"] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "evaluations",
        },
      },
      {
        $addFields: {
          currentEvaluation: { $arrayElemAt: ["$evaluations", 0] },
        },
      },
      { $sort: sort },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ])
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
    console.log(error);
    return NextResponse.json({ error: "Failed to fetch applicants" }, { status: 500 });
  }
});

const getFilter = (careerID: string, search: string, filterStageId: string, filterSubstageId: string, filterStatus: string) => {
  const filter: any = { id: careerID };

  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }

  if (filterStatus) {
    if (filterStatus === "All Statuses") {
      filter.applicationStatus = { $in: ["Ongoing", "Dropped", "Hired", "Cancelled", null] };
    } else if (filterStatus === "Ongoing") {
      filter.applicationStatus = { $in: ["Ongoing", null] };
    } else if (filterStatus === "Invited") {
      filter.invitedFrom = { $exists: true, $ne: null };
      // Optional: if you want to include all statuses for invited candidates, don't set filter.applicationStatus
    } else {
      filter.applicationStatus = filterStatus;
    }
  }

  if (filterStageId) {
    filter.stageId = filterStageId;
  }

  if (filterSubstageId) {
    filter.substageId = filterSubstageId;
  }

  return filter;
}

const getSort = (sortBy: string) => {
  if (sortBy === "Recent Activity") {
    return { updatedAt: -1, _id: -1 };
  }

  if (sortBy === "Oldest Activity") {
    return { updatedAt: 1, _id: -1 };
  }

  if (sortBy === "Date Applied (Newest First)") {
    return { createdAt: -1, _id: -1 };
  }

  if (sortBy === "Date Applied (Oldest First)") {
    return { createdAt: 1, _id: -1 };
  }

  if (sortBy === "Alphabetical (A-Z)") {
    return { nameLower: 1, _id: -1 };
  }

  if (sortBy === "Alphabetical (Z-A)") {
    return { nameLower: -1, _id: -1 };
  }

  return { _id: -1 };
}