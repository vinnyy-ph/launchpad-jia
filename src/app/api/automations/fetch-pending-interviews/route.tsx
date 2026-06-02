import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { orgID } = await request.json();
    const { db } = await connectMongoDB();

    if (!orgID) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing orgID parameter",
        },
        { status: 400 }
      );
    }

    // Calculate date 3 days ago (configurable - change the number to adjust the time period)
    const daysAgo = 3;
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() - daysAgo);

    // Fetch all interviews with the specified filter criteria
    const interviews = await db
      .collection("interviews")
      .find({
        orgID: orgID,
        status: { $in: ["For Interview", "For AI Interview"] },
        currentStep: "AI Interview",
        applicationStatus: { $ne: "Dropped" },
        // Filter for entries where lastAutoReminder is 3 days ago or more, or doesn't exist
        $or: [
          { lastAutoReminder: { $exists: false } },
          { lastAutoReminder: { $lte: reminderDate } },
        ],
      })
      .toArray();

    // Get all career IDs from interviews
    const careerIds = interviews
      .map((interview) => interview.id)
      .filter((id) => id);

    // Fetch careers to check their status
    const careers = await db
      .collection("careers")
      .find({
        id: { $in: careerIds },
        status: { $ne: "inactive" },
      })
      .toArray();

    // Create a set of active career IDs for quick lookup
    const activeCareerIds = new Set(
      careers.map((career) => career.id.toString())
    );

    // Filter interviews to only include those with active careers
    const filteredInterviews = interviews.filter((interview) => {
      // If interview has no id field, include it (for backward compatibility)
      if (!interview.id) {
        return true;
      }
      // Only include if the career is active
      return activeCareerIds.has(interview.id.toString());
    });

    // Add reminderType field to each interview
    const results = filteredInterviews.map((interview) => ({
      ...interview,
      reminderType: "Take AI Interview",
    }));

    return NextResponse.json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Error fetching interviews for CV reminders:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch interviews for CV reminders",
      },
      { status: 500 }
    );
  }
});
