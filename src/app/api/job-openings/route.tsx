import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ARCHIVE_MATCH_STAGE } from "@/lib/utils/careerArchive";

export async function POST() {
  try {
    const { db } = await connectMongoDB();

    const careers = await db
      .collection("careers")
      .aggregate([
        ARCHIVE_MATCH_STAGE,
        {
          $lookup: {
            from: "organizations",
            let: { orgID: "$orgID" },
            pipeline: [
              {
                $addFields: {
                  _id: { $toString: "$_id" },
                },
              },
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$orgID"],
                  },
                },
              },
            ],
            as: "organization",
          },
        },
        {
          $unwind: {
            path: "$organization",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: {
            $and: [
              { status: "active" },
              { "organization.tier": { $in: ["corporate", "enterprise"] } },
            ],
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $project: {
            cvSecretPrompt: 0,
            interviewSecretPrompt: 0,
          },
        },
      ])
      .toArray();

    return NextResponse.json(careers);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch careers" },
      { status: 500 }
    );
  }
}
