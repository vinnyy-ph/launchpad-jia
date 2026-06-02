import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json(
        { error: "orgId parameter is required" },
        { status: 400 },
      );
    }

    const { db } = await connectMongoDB();

    // Try to parse orgId to ObjectId; support both string and ObjectId storage in interviews.orgID
    let orgObjectId: ObjectId | null = null;
    try {
      orgObjectId = new ObjectId(orgId);
    } catch {
      orgObjectId = null;
    }

    // Build orgID match conditions
    const orgMatchConditions = orgObjectId
      ? [{ orgID: orgObjectId }, { orgID: orgId }]
      : [{ orgID: orgId }];

    // Use aggregation to deduplicate by email at the database level
    const uniqueApplicants = await db
      .collection("interviews")
      .aggregate([
        {
          $match: {
            $or: orgMatchConditions,
            email: { $exists: true, $ne: null},
          },
        },
        {
          // Normalize email to lowercase for proper deduplication
          $addFields: {
            emailLower: { $toLower: "$email" },
          },
        },
        {
          // Group by lowercase email to get unique recipients
          $group: {
            _id: "$emailLower",
            id: { $first: "$_id" },
            name: { $first: "$name" },
            email: { $first: "$email" }, // Keep original case
            image: { $first: "$image" },
          },
        },
        {
          // Reshape the output
          $project: {
            _id: "$id",
            name: { $ifNull: ["$name", ""] },
            email: "$email",
            image: { $ifNull: ["$image", null] },
          },
        },
        {
          // Sort by name for consistent ordering
          $sort: { name: 1, email: 1 },
        },
        {
          // Limit to prevent excessive data transfer
          $limit: 5000,
        },
      ])
      .toArray();

    return NextResponse.json(
      {
        applicants: uniqueApplicants,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching applicants emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch applicants emails" },
      { status: 500 },
    );
  }
}
