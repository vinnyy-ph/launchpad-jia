import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextRequest, NextResponse } from "next/server";
import { toIdString } from "@/lib/utils/dataTransform";

export async function GET(request: NextRequest) {
  const { db } = await connectMongoDB();

  // Get orgID from query parameters
  const url = new URL(request.url);
  const orgID = url.searchParams.get("orgID") || url.searchParams.get("orgId");

  if (!orgID) {
    return NextResponse.json(
      { error: "orgID is required" },
      { status: 400 }
    );
  }

  const emailSettingsModel = db.collection("email-settings");
  const result = await emailSettingsModel
    .aggregate([
      {
        $match: {
          orgID: toIdString(orgID), // Filter by orgID
        },
      },
      {
        $addFields: {
          userID: { $toObjectId: "$userID" }, // Convert userID from string to ObjectId
        },
      },
      {
        $lookup: {
          from: "members", // Name of the collection to join
          localField: "userID", // Field from "email-settings" to match with "members"
          foreignField: "_id", // Field from "members" collection to match with "email-settings"
          as: "userDetails", // Alias for the new array of matching documents
        },
      },
      {
        $unwind: {
          path: "$userDetails", // Flatten the "userDetails" array
        },
      },
      {
        $project: {
          _id: 1,
          userID: 1,
          userDetails: {
            name: 1,
            email: 1,
            picture: 1,
            image: 1,
          },
        },
      },
    ])
    .toArray();

  return NextResponse.json({ result });
}
