import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { DEFAULT_JOB_PIPELINE } from "../../../lib/utils/constants";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { db } = await connectMongoDB();
  const { searchParams } = new URL(request.url);
  const candidateEmail = searchParams.get("candidateEmail");
  const orgID = searchParams.get("orgID");
  try {
    const interviews = await db.collection("interviews").aggregate([
      { $match: { email: candidateEmail, orgID: orgID } },
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
                    { $eq: ["$interviewUID", "$$interviewUID"]  },
                    { $eq: ["$action", "$$status"] },
                  ],
                } 
              } 
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "evaluations"
        },
      },
      {
        $addFields: {
          "currentEvaluation": {
            $arrayElemAt: [
              "$evaluations",
              0
            ]
          }
        }
      },
      { $sort: { createdAt: -1 } },
    ])
    .toArray();

    const careers = await db.collection("careers").find({ id: { $in: [...new Set(interviews.map((i) => i.id))] } }).toArray();

    return NextResponse.json(
      interviews.map((i) => {
        const career = careers.find((c) => c.id === i.id);
        return {
          ...i,
          careerId: career?._id?.toString() || i?.careerId || null,
          careerTitle: career?.jobTitle || career?.title || career?.name || i?.jobTitle || null,
          pipelineStages: career?.pipelineStages || DEFAULT_JOB_PIPELINE,
        };
      })
    );
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch interviews" }, { status: 500 });
  }
});