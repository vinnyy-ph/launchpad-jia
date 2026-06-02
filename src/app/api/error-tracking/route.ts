import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const errorName = searchParams.get("errorName") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Connect to MongoDB
    const { db } = await connectMongoDB();
    const collection = db.collection("jia-error-trace");

    // Build query based on search parameters
    let query: any = {};

    if (search) {
      query.$or = [
        { interviewID: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { logDate: { $regex: search, $options: "i" } },
      ];
    }

    if (errorName) {
      query.name = errorName;
    }

    // Get total count for pagination
    const totalCount = await collection.countDocuments(query);

    // Fetch errors with pagination
    const errors = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      data: errors,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching error tracking data:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch error tracking data",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
});
