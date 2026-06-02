import { NextRequest, NextResponse } from "next/server";
import backendAuthCheck from "@/lib/firebase/backendAuthCheck";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { toIdString } from "@/lib/utils/dataTransform";

/**
 * GET /api/outlook/users
 * Fetch all org users with Outlook connected
 * Returns: userId, email, mode, connection status, lastSyncedAt
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = request.headers
      .get("authorization")
      ?.replace("Bearer ", "");
    if (!authToken) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const decodedToken = await backendAuthCheck(authToken);
    if (!decodedToken) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");

    if (!orgID) {
      return new NextResponse("Missing orgID", { status: 400 });
    }

    const { db } = await connectMongoDB();

    // Check if requester is member of org
    const isMember = await db.collection("members").findOne({
      orgID: toIdString(orgID),
      email: decodedToken.email,
    });

    if (!isMember) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Fetch all org users with Outlook connected
    const outlookUsers = await db
      .collection("email-settings")
      .aggregate([
        {
          $match: {
            orgID: toIdString(orgID),
            outlookConnected: true,
          },
        },
        {
          $lookup: {
            from: "members",
            localField: "userID",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 0,
            userId: "$userID",
            email: "$outlookEmail",
            mode: { $literal: "outlook" },
            connected: "$outlookConnected",
            lastSyncedAt: "$outlookDateSync",
            userName: "$user.name",
            userEmail: "$user.email",
          },
        },
      ])
      .toArray();

    return NextResponse.json(
      {
        success: true,
        users: outlookUsers,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Outlook users fetch error:", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
