import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const orgId = searchParams.get("orgId");
  const cursor = searchParams.get("cursor");
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!orgId) {
    return NextResponse.json(
      { error: "Organization ID is required" },
      { status: 400 }
    );
  }

  try {
    const { db } = await connectMongoDB();

    const query: any = { orgId };

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp.$lte = end;
      }
    }

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
      transactions: results,
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
