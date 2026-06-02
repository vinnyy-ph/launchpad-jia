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

    // Fetch all interviews that have had reminders sent
    const interviews = await db
      .collection("interviews")
      .find({
        orgID: orgID,
        lastAutoReminder: { $exists: true, $ne: null },
      })
      .sort({ lastAutoReminder: -1 }) // Sort by most recent reminder first
      .toArray();

    // Add calculated fields to each interview
    const results = interviews.map((interview) => {
      const lastReminderDate = new Date(interview.lastAutoReminder);
      const now = new Date();
      const timeSinceReminder = now.getTime() - lastReminderDate.getTime();
      const daysSinceReminder = Math.floor(
        timeSinceReminder / (1000 * 60 * 60 * 24)
      );
      const hoursSinceReminder = Math.floor(
        timeSinceReminder / (1000 * 60 * 60)
      );
      const minutesSinceReminder = Math.floor(timeSinceReminder / (1000 * 60));

      let timeSinceText = "";
      if (daysSinceReminder > 0) {
        timeSinceText = `${daysSinceReminder} day${
          daysSinceReminder > 1 ? "s" : ""
        } ago`;
      } else if (hoursSinceReminder > 0) {
        timeSinceText = `${hoursSinceReminder} hour${
          hoursSinceReminder > 1 ? "s" : ""
        } ago`;
      } else if (minutesSinceReminder > 0) {
        timeSinceText = `${minutesSinceReminder} minute${
          minutesSinceReminder > 1 ? "s" : ""
        } ago`;
      } else {
        timeSinceText = "Just now";
      }

      return {
        ...interview,
        timeSinceReminder: timeSinceText,
        daysSinceReminder,
      };
    });

    return NextResponse.json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Error fetching past reminders:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch past reminders",
      },
      { status: 500 }
    );
  }
});
