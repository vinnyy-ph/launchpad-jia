import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get("cursor");
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  // Get user email from authenticated session
  const userEmail = request.user?.email;
  if (!userEmail) {
    return NextResponse.json(
      { error: "User email not found in session" },
      { status: 401 }
    );
  }

  // Try to get orgID from query params first (for flexibility)
  let userOrgId = searchParams.get("orgID") || searchParams.get("orgId");

  // If not in query params, try to get from user session
  if (!userOrgId) {
    userOrgId = request.user?.orgID || request.user?.orgId;
  }

  // If still not found, look up from members collection
  if (!userOrgId) {
    const { db } = await connectMongoDB();
    const member = await db.collection("members").findOne({ email: userEmail });
    if (member) {
      userOrgId = member.orgID || member.organizationId;
    }
  }

  if (!userOrgId) {
    return NextResponse.json(
      { error: "Organization ID not found. Please ensure you are associated with an organization." },
      { status: 400 }
    );
  }

  try {
    const { db } = await connectMongoDB();

    // Build query - scoped to user's organization
    const query: Record<string, unknown> = { orgId: userOrgId };

    // Add date filters if provided
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        (query.timestamp as Record<string, Date>).$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (query.timestamp as Record<string, Date>).$lte = end;
      }
    }

    // Add cursor for pagination
    if (cursor) {
      query._id = { $lt: new ObjectId(cursor) };
    }

    const transactions = await db
      .collection("credit-transactions")
      .find(query)
      .sort({ timestamp: -1, _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = transactions.length > limit;
    const results = hasMore ? transactions.slice(0, limit) : transactions;
    const nextCursor = hasMore ? results[results.length - 1]._id.toString() : null;

    return NextResponse.json({
      transactions: results.map((tx) => ({
        ...tx,
        _id: tx._id.toString(),
      })),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("Error fetching credit transactions:", error);
    return NextResponse.json(
      { error: "Error fetching credit transactions" },
      { status: 500 }
    );
  }
});

