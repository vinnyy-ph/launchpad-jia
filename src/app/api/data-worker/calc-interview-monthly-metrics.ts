import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export async function GET(request: Request) {
  try {
    // Validate that the request is coming from localhost
    const origin = request.headers.get("origin") || request.headers.get("host");
    const isLocalhost =
      origin?.includes("localhost") ||
      origin?.includes("127.0.0.1") ||
      origin?.includes("::1");

    if (!isLocalhost) {
      return Response.json(
        {
          error: "Access denied",
          message: "This endpoint is only accessible from localhost",
          origin: origin,
        },
        { status: 403 }
      );
    }

    const { db } = await connectMongoDB();

    // Define September 2025 date range
    const september2025Start = new Date("2025-09-01T00:00:00.000Z").getTime();
    const september2025End = new Date("2025-10-01T00:00:00.000Z").getTime();

    console.log(
      `Querying interviews for September 2025 (${september2025Start} to ${september2025End})`
    );

    // Step 1: Get all interviews for September 2025 with their interviewID
    const interviews = await db
      .collection("interviews")
      .find({
        completedAt: {
          $gte: september2025Start,
          $lt: september2025End,
        },
        interviewID: { $exists: true, $ne: null },
      })
      .toArray();

    console.log(`Found ${interviews.length} interviews in September 2025`);

    const dayGroups: any[] = [];
    const multiDateInterviews: any[] = [];
    const allDurations: number[] = [];

    // Process each interview
    for (const interview of interviews) {
      // Step 2: Get all matching transcripts for this interviewID
      const transcripts = await db
        .collection("transcripts")
        .find({ interviewID: interview.interviewID })
        .sort({ time: 1 }) // Step 3: Sort by time
        .toArray();

      if (transcripts.length === 0) continue;

      // Step 4: Group transcripts by day
      const dayGroupsForInterview: { [key: string]: any[] } = {};

      transcripts.forEach((transcript) => {
        const date = new Date(transcript.time);
        const dayKey = date.toISOString().split("T")[0]; // YYYY-MM-DD format

        if (!dayGroupsForInterview[dayKey]) {
          dayGroupsForInterview[dayKey] = [];
        }
        dayGroupsForInterview[dayKey].push(transcript);
      });

      // Step 5: Convert day groups to array format
      const dayGroupArray = Object.entries(dayGroupsForInterview).map(
        ([date, transcripts]) => ({
          date,
          interviewID: interview.interviewID,
          transcriptCount: transcripts.length,
          transcripts: transcripts.map((t) => ({
            time: t.time,
            uid: t.uid,
            type: t.type,
          })),
        })
      );

      // Check if interview spans multiple dates
      if (dayGroupArray.length > 1) {
        multiDateInterviews.push({
          interviewID: interview.interviewID,
          dates: dayGroupArray.map((dg) => dg.date),
          dayCount: dayGroupArray.length,
        });
      }

      // Step 6: Calculate duration for each day group
      const dayDurations = dayGroupArray.map((dayGroup) => {
        if (dayGroup.transcripts.length === 0) {
          return {
            ...dayGroup,
            durationSeconds: 0,
            durationMinutes: 0,
            startTime: null,
            endTime: null,
          };
        }

        const sortedTranscripts = dayGroup.transcripts.sort(
          (a, b) => a.time - b.time
        );
        const firstTranscript = sortedTranscripts[0];
        const lastTranscript = sortedTranscripts[sortedTranscripts.length - 1];

        // Duration in seconds
        const durationSeconds =
          (lastTranscript.time - firstTranscript.time) / 1000;

        return {
          ...dayGroup,
          durationSeconds,
          durationMinutes: Math.round((durationSeconds / 60) * 100) / 100,
          startTime: firstTranscript.time,
          endTime: lastTranscript.time,
        };
      });

      // Add to overall day groups
      dayGroups.push(...dayDurations);

      // Collect all durations for final average calculation
      dayDurations.forEach((day) => {
        allDurations.push(day.durationSeconds);
      });
    }

    // Step 7: Calculate final average interview duration
    const totalInterviews = interviews.length;
    const averageDurationSeconds =
      allDurations.length > 0
        ? allDurations.reduce((sum, duration) => sum + duration, 0) /
          allDurations.length
        : 0;
    const averageDurationMinutes =
      Math.round((averageDurationSeconds / 60) * 100) / 100;
    const totalDurationMinutes =
      Math.round(
        (allDurations.reduce((sum, duration) => sum + duration, 0) / 60) * 100
      ) / 100;

    return Response.json({
      message: "Interview statistics for September 2025 retrieved successfully",
      data: {
        period: "September 2025",
        totalInterviews: totalInterviews,
        averageInterviewDuration: averageDurationMinutes, // in minutes
        totalDuration: totalDurationMinutes, // in minutes
        dayGroups: dayGroups, // Array of day groups from step 5
        multiDateInterviews: multiDateInterviews, // Interviews spanning multiple dates
        dateRange: {
          start: new Date(september2025Start).toISOString(),
          end: new Date(september2025End).toISOString(),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error retrieving interview statistics:", error);
    return Response.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
