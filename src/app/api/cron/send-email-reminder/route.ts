import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { sendEmailV2 } from "@/lib/utils/emailAutomation";

/**
 * Send Email Reminder Cron Job API
 *
 * Processes reminder automations: finds active "Reminder" automations with
 * reminder_delay, finds candidates in the right stage/substage, and sends
 * reminder emails where the delay has elapsed since lastAutoReminder/updatedAt.
 *
 * Should be triggered frequently (e.g., every minute) via Vercel cron.
 */
export async function GET() {
  try {
    const { db } = await connectMongoDB();
    const automationModel = db.collection("automations");
    const careerModel = db.collection("careers");
    const interviewModel = db.collection("interviews");

    console.log("Starting email reminder processing...");
    console.log(`Timestamp: ${new Date().toISOString()}`);

    const automations = await automationModel
      .find({
        "automation.trigger_on_event": "Reminder",
        "automation.active": true,
        "automation.reminder_delay": { $exists: true },
        "automation.reminder_delay_unit": { $exists: true },
      })
      .toArray();

    console.log(
      `Found ${automations.length} active reminder automation(s)`,
    );

    const now = new Date();
    let successCount = 0;
    let errorCount = 0;
    const results: Array<{
      automationId: string;
      careerId: string;
      candidateEmail: string;
      status: "sent" | "skipped" | "failed";
      error?: string;
    }> = [];

    for (const automation of automations) {
      let reminderDelayMs = 0;
      switch (automation.automation.reminder_delay_unit) {
        case "Minutes":
          reminderDelayMs = automation.automation.reminder_delay * 60 * 1000;
          break;
        case "Hours":
          reminderDelayMs =
            automation.automation.reminder_delay * 60 * 60 * 1000;
          break;
        case "Days":
          reminderDelayMs =
            automation.automation.reminder_delay * 24 * 60 * 60 * 1000;
          break;
        default:
          continue;
      }

      const career = await careerModel.findOne({
        _id: new ObjectId(automation.careerId),
      });
      if (!career) continue;

      const candidates = await interviewModel
        .find({
          id: career.id,
          stageId: automation.stage_id,
          substageId: automation.substage_id,
          applicationStatus: "Ongoing",
        })
        .toArray();

      if (candidates.length === 0) continue;

      for (const candidate of candidates) {
        const automationId = automation._id.toString();
        const careerId = career._id.toString();
        const candidateEmail = candidate.email || "unknown";

        let baseDate: Date | null = null;
        if (candidate.lastAutoReminder) {
          baseDate = new Date(candidate.lastAutoReminder);
        } else if (candidate.updatedAt) {
          baseDate = new Date(candidate.updatedAt);
        } else if (candidate.lastActivityAt) {
          baseDate = new Date(candidate.lastActivityAt);
        }

        if (!baseDate || isNaN(baseDate.getTime())) {
          results.push({
            automationId,
            careerId,
            candidateEmail,
            status: "skipped",
            error: "No base date for reminder delay",
          });
          continue;
        }

        const scheduledSendDate = new Date(
          baseDate.getTime() + reminderDelayMs,
        );
        if (scheduledSendDate > now) {
          results.push({
            automationId,
            careerId,
            candidateEmail,
            status: "skipped",
            error: "Reminder not yet due",
          });
          continue;
        }

        try {
          console.log(
            `Sending reminder to ${candidate.email} (careerId=${career._id}, stage=${automation.stage_id}/${automation.substage_id})`,
          );
          await sendEmailV2({
            email: candidate.email,
            stage_id: automation.stage_id,
            substage_id: automation.substage_id,
            trigger_on_event: automation.automation.trigger_on_event,
            from_stage: automation.automation.from_stage,
            to_stage: automation.automation.to_stage,
            careerId: career._id.toString(),
            orgID: career.orgID,
            userId: null,
          });

          const updateResult = await db.collection("interviews").updateOne(
            { _id: new ObjectId(String(candidate._id)) },
            { $set: { lastAutoReminder: new Date() } },
          );

          if (updateResult.matchedCount === 0) {
            console.warn(
              `Failed to update lastAutoReminder for interview _id=${candidate._id}`,
            );
          }

          successCount++;
          results.push({
            automationId,
            careerId,
            candidateEmail,
            status: "sent",
          });
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.error(
            `Error sending reminder to ${candidateEmail}:`,
            error,
          );
          errorCount++;
          results.push({
            automationId,
            careerId,
            candidateEmail,
            status: "failed",
            error: message,
          });
        }
      }
    }

    const summary = {
      message: "Email reminder processing complete",
      timestamp: new Date().toISOString(),
      totalAutomations: automations.length,
      successCount,
      errorCount,
      results,
    };

    console.log("\nEmail reminder processing complete:");
    console.log(`  Active automations: ${automations.length}`);
    console.log(`  Success: ${successCount}`);
    console.log(`  Errors: ${errorCount}`);

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error("Email reminder processing failed:", error);
    return NextResponse.json(
      {
        error: "Email reminder processing failed",
        details: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
