import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { db } = await connectMongoDB();
  const { searchParams } = new URL(request.url);
  const careerID = searchParams.get("careerID");
  const userEmail = request.user.email;

  try {
    const interviews = await db
      .collection("interviews")
      .aggregate([
        { $match: { id: careerID } },
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
          $lookup: {
            from: "comments",
            let: {
              interviewID: "$interviewID"
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    // Application-level comments only
                    $and: [
                      { $eq: ["$interviewID", "$$interviewID"] },
                      { $eq: ["$type", "application"] },
                      { $ne: ["$deleted", true] }
                    ]
                  }
                }
              }
            ],
            as: "comments",
          },
        },
        {
          $lookup: {
            from: "interview-history",
            let: {
              interviewUID: { $toString: "$_id" }
            },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$interviewUID", "$$interviewUID"] }
                }
              },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: "history",
          },
        },
        {
          $lookup: {
            from: "recruiter-history",
            let: {
              interviewUID: { $toString: "$_id" }
            },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$interviewUID", "$$interviewUID"] }
                }
              },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: "recruiterHistory",
          },
        },
        {
          $lookup: {
            from: "applicants",
            let: {
              candidateEmailLower: { $toLower: { $ifNull: ["$email", ""] } },
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [
                      { $toLower: { $ifNull: ["$email", ""] } },
                      "$$candidateEmailLower",
                    ],
                  },
                },
              },
              {
                $project: {
                  status: 1,
                },
              },
              {
                $limit: 1,
              },
            ],
            as: "applicantAccount",
          },
        },
        {
          $addFields: {
            currentEvaluation: {
              $arrayElemAt: ["$evaluations", 0],
            },
            commentCount: { $size: "$comments" },
            newCommentCount: {
              $size: {
                $filter: {
                  input: "$comments",
                  as: "comment",
                  cond: {
                    $not: {
                      $in: [userEmail, { $ifNull: ["$$comment.viewedBy", []] }]
                    }
                  }
                }
              }
            },
            latestApplicationMovement: {
              $arrayElemAt: ["$history", 0],
            },
            latestRecruiterAction: {
              $arrayElemAt: ["$recruiterHistory", 0],
            },
            applicantStatus: {
              $ifNull: [{ $arrayElemAt: ["$applicantAccount.status", 0] }, null],
            },
            hasJiaAccount: {
              $cond: {
                if: {
                  $eq: [{ $size: "$applicantAccount" }, 0],
                },
                then: false,
                else: {
                  $ne: [
                    {
                      $toLower: {
                        $ifNull: [
                          { $arrayElemAt: ["$applicantAccount.status", 0] },
                          "joined",
                        ],
                      },
                    },
                    "invited",
                  ],
                },
              },
            },
          },
        },
        {
          $project: {
            comments: 0, // Remove comments array from final output to reduce payload size
            applicantAccount: 0,
          }
        }
      ])
      .toArray();
    // console.log(interviews);
    return NextResponse.json(interviews);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch interviews" },
      { status: 500 }
    );
  }
});
