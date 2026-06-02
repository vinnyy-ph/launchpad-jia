import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";

/**
 * Processes pre-screening auto-drops that are due.
 * Intended to run on a scheduled cadence (every 8 hours).
 */
export async function GET() {
  try {
    const { db } = await connectMongoDB();
    const now = new Date();

    const dueInterviews = await db
      .collection("interviews")
      .find({
        "preScreeningAutoDrop.status": "scheduled",
        "preScreeningAutoDrop.scheduledAt": { $lte: now },
        applicationStatus: { $nin: ["Dropped", "Cancelled", "Hired"] },
      })
      .toArray();

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const interview of dueInterviews) {
      try {
        const reason = interview?.preScreeningAutoDrop?.reason || "No reason provided";
        const updatedAtMs = Date.now();

        const updateResult = await db.collection("interviews").updateOne(
          {
            _id: interview._id,
            "preScreeningAutoDrop.status": "scheduled",
            applicationStatus: { $nin: ["Dropped", "Cancelled", "Hired"] },
          },
          {
            $set: {
              applicationStatus: "Dropped",
              updatedAt: updatedAtMs,
              applicationMetadata: {
                updatedAt: updatedAtMs,
                updatedBy: { name: "Jia" },
                action: "Dropped",
                reason,
              },
              preScreeningAutoDrop: {
                ...interview.preScreeningAutoDrop,
                status: "completed",
                processedAt: new Date(),
              },
            },
          }
        );

        if (!updateResult.modifiedCount) {
          skipped++;
          continue;
        }

        const career = await db.collection("careers").findOne({ id: interview.id });

        await db.collection("interview-history").insertOne({
          interviewUID: interview._id.toString(),
          careerId: career?._id?.toString(),
          fromStage: interview.currentStep || "CV Screening",
          fromStageId: interview.stageId || "1",
          fromSubstageId: interview.substageId || "2",
          action: "Dropped",
          dropReason: reason,
          cvScreeningReason: reason,
          updatedBy: { name: "Jia" },
          createdAt: updatedAtMs,
        });

        if (career) {
          await db.collection("careers").updateOne(
            { _id: career._id },
            { $set: { lastActivityAt: new Date() } }
          );
        }

        processed++;
      } catch (error) {
        console.error("Failed to process scheduled pre-screening auto-drop:", error);
        errors++;
      }
    }

    return NextResponse.json(
      {
        message: "Pre-screening auto-drop processing complete",
        timestamp: now.toISOString(),
        stats: {
          totalDue: dueInterviews.length,
          processed,
          skipped,
          errors,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Pre-screening auto-drop cron failed:", error);
    return NextResponse.json(
      {
        error: "Pre-screening auto-drop processing failed",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

