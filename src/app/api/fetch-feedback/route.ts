import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const { db } = await connectMongoDB();
  const { orgID, page = 1, limit = 10, rating, sort, searchQuery } = await req.json();
  console.log(orgID, page, limit, rating, sort, searchQuery);

  const match: any = {
    orgID,
  };

  let searchMatch: any = [];
  if (searchQuery?.trim() !== "") {
    searchMatch.push({
      $match: {
        $or: [
          { "interviewDetails.name": { $regex: searchQuery, $options: "i" } },
          { "interviewDetails.email": { $regex: searchQuery, $options: "i" } },
          { "interviewDetails.jobTitle": { $regex: searchQuery, $options: "i" } },
          { "feedback": { $regex: searchQuery, $options: "i" } },
        ]
      }
    });
  }

  if (rating && rating !== "All Ratings" && !isNaN(parseInt(rating))) {
    match.rating = { $eq: parseInt(rating) };
  }

  let sortStage: any = { createdAt: -1, _id: -1 };
  if (sort && sort === "Oldest") {
    sortStage = { createdAt: 1, _id: 1 };
  }

  const feedback = await db
    .collection("feedback")
    .aggregate([
      { 
        $match: match,
      },
      {
        $lookup: {
          from: "interviews",
          localField: "interviewID",
          foreignField: "interviewID",
          as: "interviewDetails",
        },
      },
      {
        $unwind: {
          path: "$interviewDetails",
          preserveNullAndEmptyArrays: false,
        },
      },
      ...searchMatch,
      {
        $facet: {
          data: [
            {
              $sort: sortStage,
            },
            {
              $skip: (page - 1) * limit,
            },
            {
              $limit: limit,
            },
          ],
          total: [
            {
              $count: "count",
            },
          ],
        }
      }
    ])
    .toArray();

  return NextResponse.json({
    feedback: feedback[0]?.data || [],
    total: feedback[0]?.total?.[0]?.count || 0,
  });
});
