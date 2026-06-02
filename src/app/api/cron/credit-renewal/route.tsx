import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { randomUUID } from "crypto";

/**
 * Credit Renewal Cron Job API
 * 
 * Processes monthly credit renewals for organizations on credit-based plans.
 * Should be triggered daily via Vercel cron.
 */
export async function GET() {
  try {
    const { db } = await connectMongoDB();

    console.log("Starting credit renewal processing...");
    console.log(`Timestamp: ${new Date().toISOString()}`);

    // Use pure UTC for comparisons
    const actualNow = new Date();
    const todayStart = new Date(Date.UTC(
      actualNow.getUTCFullYear(),
      actualNow.getUTCMonth(),
      actualNow.getUTCDate(),
      0, 0, 0, 0
    ));

    const tomorrow = new Date(todayStart);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    // Query window is today's UTC day
    const queryStartWindow = todayStart;

    // Find organizations with credit-based plans due for renewal using nested structure
    const orgsToRenew = await db
      .collection("organizations")
      .find({
        status: "active",
        nextRenewalDate: { $gte: queryStartWindow, $lt: tomorrow },
        "creditBasedPlan.planId": { $exists: true, $ne: null },
      })
      .toArray();

    console.log(`Found ${orgsToRenew.length} organizations due for renewal`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const results: string[] = [];

    for (const org of orgsToRenew) {
      try {
        // Create a unique renewal period key for idempotency (YYYY-MM-DD format)
        const renewalPeriodKey = org.nextRenewalDate.toISOString().split("T")[0];

        // Idempotency check: Skip if we already processed this renewal period
        const existingRenewal = await db
          .collection("credit-transactions")
          .findOne({
            orgId: org._id.toString(),
            type: "renewal",
            renewalPeriod: renewalPeriodKey,
          });

        if (existingRenewal) {
          console.log(`\u23ED Skipping org ${org.name} - already renewed for period ${renewalPeriodKey}`);
          results.push(`Skipped: ${org.name} - already renewed for period ${renewalPeriodKey}`);
          skippedCount++;
          continue;
        }

        // Use credit-based plan ID from nested structure
        const planIdToUse = org.creditBasedPlan?.planId;
        const planEndDate = org.creditBasedPlan?.endDate;

        const plan = await db
          .collection("organization-plans")
          .findOne({ _id: new ObjectId(planIdToUse) });

        if (!plan) {
          console.error(`Plan not found for org ${org._id}`);
          results.push(`Error: Plan not found for org ${org.name}`);
          errorCount++;
          continue;
        }

        if (plan.schema !== "credit-based") {
          console.log(`\u23ED Skipping org ${org.name} - not on credit-based plan`);
          results.push(`Skipped: ${org.name} - not on credit-based plan`);
          skippedCount++;
          continue;
        }

        // Check if plan is still published
        if (plan.status !== "published") {
          console.log(`\u23ED Skipping org ${org.name} - plan is unpublished`);
          results.push(`Skipped: ${org.name} - plan is unpublished`);
          skippedCount++;
          continue;
        }

        // Check if plan has expired
        if (planEndDate) {
          const endDate = new Date(planEndDate);
          if (endDate < todayStart) {
            console.log(`\u23ED Skipping org ${org.name} - plan expired`);
            results.push(`Skipped: ${org.name} - plan expired`);
            skippedCount++;
            continue;
          }
        }

        // Calculate next renewal date
        const nextRenewal = new Date(org.nextRenewalDate);
        nextRenewal.setMonth(nextRenewal.getMonth() + 1);

        // Check if next renewal would exceed plan end date
        if (planEndDate) {
          const endDate = new Date(planEndDate);
          if (nextRenewal > endDate) {
            console.log(`⏭ Skipping org ${org.name} - next renewal would exceed plan end date`);
            results.push(`Skipped: ${org.name} - next renewal would exceed plan end date`);
            skippedCount++;
            continue;
          }
        }

        const creditsToAdd = plan.creditsPerMonth || 0;
        const currentCredits = org.creditBasedPlan?.creditsRemaining || 0;
        const newBalance = currentCredits + creditsToAdd;

        // Generate UUID-based reference ID for uniqueness
        const transaction = {
          orgId: org._id.toString(),
          timestamp: new Date(),
          referenceId: `REN-${randomUUID().split("-")[0].toUpperCase()}`,
          type: "renewal",
          amount: creditsToAdd,
          balanceAfter: newBalance,
          renewalPeriod: renewalPeriodKey, // For idempotency tracking
          createdAt: new Date(),
        };

        await db.collection("credit-transactions").insertOne(transaction);

        await db.collection("organizations").updateOne(
          { _id: org._id },
          {
            $set: {
              "creditBasedPlan.creditsRemaining": newBalance,
              creditBalanceAtRenewal: newBalance,
              nextRenewalDate: nextRenewal,
              updatedAt: new Date(),
            },
          }
        );

        console.log(`✓ Renewed org ${org.name}: +${creditsToAdd} credits (new balance: ${newBalance})`);
        results.push(`Success: ${org.name} - +${creditsToAdd} credits (balance: ${newBalance})`);
        successCount++;
      } catch (error) {
        console.error(`Error processing org ${org._id}:`, error);
        results.push(`Error: ${org.name} - ${(error as Error).message}`);
        errorCount++;
      }
    }

    const summary = {
      message: "Credit renewal processing complete",
      timestamp: new Date().toISOString(),
      stats: {
        total: orgsToRenew.length,
        success: successCount,
        skipped: skippedCount,
        errors: errorCount,
      },
      details: results,
    };

    console.log(`\nRenewal processing complete:`, summary.stats);

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error("Credit renewal processing failed:", error);
    return NextResponse.json(
      { error: "Credit renewal processing failed", details: (error as Error).message },
      { status: 500 }
    );
  }
}

