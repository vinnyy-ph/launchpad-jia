import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { interviewID } = await request.json();

    // Validate that interviewID is provided
    if (!interviewID) {
      return NextResponse.json(
        {
          success: false,
          message: "interviewID is required",
        },
        { status: 400 }
      );
    }

    // Connect to MongoDB and fetch logs
    const { db } = await connectMongoDB();

    // Find all logs matching the interviewID
    const logs = await db
      .collection("jia-error-trace")
      .find({ interviewID })
      .sort({ createdAt: -1 }) // Sort by creation date, newest first
      .toArray();

    // Transform the data to include only necessary fields
    const transformedLogs = logs.map((log) => ({
      _id: log._id,
      name: log.name || log.logTag || "Unknown",
      logDate: log.logDate || log.createdAt,
      createdAt: log.createdAt,
      data: log.data || log,
    }));

    return NextResponse.json({
      success: true,
      logs: transformedLogs,
      count: transformedLogs.length,
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch logs",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
});
