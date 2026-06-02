import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";

interface PlanHistoryEntry {
  planId: string;
  planName: string;
  schemaType: "credit-based" | "premium";
  startDate: Date;
  endDate: Date;
  action: "Applied Plan" | "Edited Plan Schedule";
  appliedBy: string;
  appliedByAvatar?: string;
  appliedAt: Date;
}

/**
 * Plan Lifecycle Cron Job API
 *
 * Handles plan activation and expiration events:
 * - Activates pending plans when their start date is reached
 * - Marks expired plans and clears nextRenewalDate to stop renewals
 *
 * Should be triggered daily via Vercel cron.
 */
export async function GET() {
  try {
    const { db } = await connectMongoDB();

    console.log("Starting plan lifecycle processing...");
    console.log(`Timestamp: ${new Date().toISOString()}`);

    const activationResults = await activatePendingPlans(db);
    const expirationResults = await expireEndedPlans(db);

    const summary = {
      message: "Plan lifecycle processing complete",
      timestamp: new Date().toISOString(),
      activation: activationResults,
      expiration: expirationResults,
    };

    console.log(`\nPlan lifecycle processing complete`);

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error("Plan lifecycle processing failed:", error);
    return NextResponse.json(
      { error: "Plan lifecycle processing failed", details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Activate pending/scheduled plans that have reached their start date.
 * Handles two scenarios:
 * 1. Scheduled switches stored in pendingXXX fields
 * 2. Legacy pending plans with pendingCredits
 */
async function activatePendingPlans(db: any) {
  console.log("\n--- Activating Pending Plans ---");

  // Use pure UTC for comparisons
  const actualNow = new Date();
  const todayStart = new Date(Date.UTC(
    actualNow.getUTCFullYear(),
    actualNow.getUTCMonth(),
    actualNow.getUTCDate(),
    0, 0, 0, 0
  ));

  let activatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const details: string[] = [];

  // === Part 1: Activate scheduled plan switches from pending fields ===
  // Find orgs with pending plan switches where start date has been reached
  const orgsWithScheduledSwitches = await db
    .collection("organizations")
    .find({
      $or: [
        {
          pendingCreditBasedPlanId: { $exists: true, $ne: null },
          pendingCreditBasedPlanIdStartDate: { $lte: actualNow },
        },
        {
          pendingPremiumPlanId: { $exists: true, $ne: null },
          pendingPremiumPlanIdStartDate: { $lte: actualNow },
        },
      ],
    })
    .toArray();

  console.log(`Found ${orgsWithScheduledSwitches.length} organizations with scheduled plan switches to activate`);

  for (const org of orgsWithScheduledSwitches) {
    try {
      // Check if credit-based scheduled switch is ready
      const creditBasedReady =
        org.pendingCreditBasedPlanId &&
        org.pendingCreditBasedPlanIdStartDate &&
        new Date(org.pendingCreditBasedPlanIdStartDate) <= actualNow;

      // Check if premium scheduled switch is ready
      const premiumReady =
        org.pendingPremiumPlanId &&
        org.pendingPremiumPlanIdStartDate &&
        new Date(org.pendingPremiumPlanIdStartDate) <= actualNow;

      const historyEntriesToAdd: PlanHistoryEntry[] = [];
      const setFields: Record<string, unknown> = { updatedAt: new Date() };
      const unsetFields: Record<string, string> = {};

      // Process credit-based scheduled switch
      if (creditBasedReady) {
        const pendingPlanId = org.pendingCreditBasedPlanId;
        const pendingStartDate = new Date(org.pendingCreditBasedPlanIdStartDate);
        const pendingEndDate = org.pendingCreditBasedPlanIdEndDate
          ? new Date(org.pendingCreditBasedPlanIdEndDate)
          : null;

        const plan = await db
          .collection("organization-plans")
          .findOne({ _id: new ObjectId(pendingPlanId) });

        if (plan) {
          // Activate credits - add frozen credits if present
          const baseCredits = org.pendingCredits || plan.creditsPerMonth || 0;
          const frozenCredits = org.frozenCredits || 0;
          const credits = baseCredits + frozenCredits;

          // Write to nested structure
          setFields.creditBasedPlan = {
            planId: pendingPlanId,
            startDate: pendingStartDate,
            endDate: pendingEndDate,
            creditsRemaining: credits,
          };
          setFields.creditBalanceAtRenewal = credits;
          const nextRenewal = new Date(pendingStartDate);
          nextRenewal.setMonth(nextRenewal.getMonth() + 1);
          setFields.nextRenewalDate = nextRenewal;

          // Clear pending fields and frozen credits
          unsetFields.pendingCreditBasedPlanId = "";
          unsetFields.pendingCreditBasedPlanIdStartDate = "";
          unsetFields.pendingCreditBasedPlanIdEndDate = "";
          unsetFields.pendingCredits = "";
          unsetFields.pendingCreditBasedPlanCreatedBy = "";
          unsetFields.pendingCreditBasedPlanCreatedByAvatar = "";
          if (frozenCredits > 0) {
            unsetFields.frozenCredits = "";
          }

          // Use stored creator info for history, fallback to any admin
          const appliedBy = org.pendingCreditBasedPlanCreatedBy || "System Cron";
          const appliedByAvatar = org.pendingCreditBasedPlanCreatedByAvatar;

          historyEntriesToAdd.push({
            planId: pendingPlanId,
            planName: plan.name,
            schemaType: "credit-based",
            startDate: pendingStartDate,
            endDate: pendingEndDate || new Date(),
            action: "Applied Plan",
            appliedBy: appliedBy,
            appliedByAvatar: appliedByAvatar,
            appliedAt: new Date(),
          });

          console.log(`✓ Activated scheduled credit-based plan for org ${org.name}: ${plan.name}`);
          details.push(`Success: ${org.name} - activated scheduled credit-based ${plan.name}`);
        }
      }

      // Process premium scheduled switch
      if (premiumReady) {
        const pendingPlanId = org.pendingPremiumPlanId;
        const pendingStartDate = new Date(org.pendingPremiumPlanIdStartDate);
        const pendingEndDate = org.pendingPremiumPlanIdEndDate
          ? new Date(org.pendingPremiumPlanIdEndDate)
          : null;

        const plan = await db
          .collection("organization-plans")
          .findOne({ _id: new ObjectId(pendingPlanId) });

        if (plan) {
          // Write to nested structure
          setFields.premiumPlan = {
            planId: pendingPlanId,
            startDate: pendingStartDate,
            endDate: pendingEndDate,
            jobSlotAdjustment: 0,
          };

          // Clear pending fields
          unsetFields.pendingPremiumPlanId = "";
          unsetFields.pendingPremiumPlanIdStartDate = "";
          unsetFields.pendingPremiumPlanIdEndDate = "";
          unsetFields.pendingPremiumPlanCreatedBy = "";
          unsetFields.pendingPremiumPlanCreatedByAvatar = "";

          // Use stored creator info for history, fallback to any admin
          const appliedBy = org.pendingPremiumPlanCreatedBy || "System Cron";
          const appliedByAvatar = org.pendingPremiumPlanCreatedByAvatar;

          historyEntriesToAdd.push({
            planId: pendingPlanId,
            planName: plan.name,
            schemaType: "premium",
            startDate: pendingStartDate,
            endDate: pendingEndDate || new Date(),
            action: "Applied Plan",
            appliedBy: appliedBy,
            appliedByAvatar: appliedByAvatar,
            appliedAt: new Date(),
          });

          console.log(`✓ Activated scheduled premium plan for org ${org.name}: ${plan.name}`);
          details.push(`Success: ${org.name} - activated scheduled premium ${plan.name}`);
        }
      }

      if (historyEntriesToAdd.length > 0) {
        const updateOp: Record<string, unknown> = { $set: setFields };
        if (Object.keys(unsetFields).length > 0) {
          updateOp.$unset = unsetFields;
        }
        updateOp.$push = { planHistory: { $each: historyEntriesToAdd } };

        await db.collection("organizations").updateOne({ _id: org._id }, updateOp as any);
        activatedCount++;
      }
    } catch (error) {
      console.error(`Error activating scheduled plan for org ${org._id}:`, error);
      details.push(`Error: ${org.name} - ${(error as Error).message}`);
      errorCount++;
    }
  }

  // === Part 2: Legacy - Activate plans with pendingCredits but no pending fields ===
  // (for backward compatibility with plans assigned before pending fields were added)
  const orgsWithLegacyPending = await db
    .collection("organizations")
    .find({
      pendingCredits: { $exists: true, $gt: 0 },
      pendingCreditBasedPlanId: { $exists: false },
      "creditBasedPlan.startDate": { $lte: actualNow },
    })
    .toArray();

  console.log(`Found ${orgsWithLegacyPending.length} organizations with legacy pending credits to activate`);

  for (const org of orgsWithLegacyPending) {
    try {
      const planHistory = (org.planHistory || []) as PlanHistoryEntry[];
      const alreadyActivated = planHistory.some(
        (entry) =>
          entry.action === "Applied Plan" && entry.planId === org.creditBasedPlan?.planId
      );

      if (alreadyActivated) {
        console.log(`⏭ Skipping org ${org.name} - already activated`);
        details.push(`Skipped: ${org.name} - already activated`);
        skippedCount++;
        continue;
      }

      const plan = await db
        .collection("organization-plans")
        .findOne({ _id: new ObjectId(org.creditBasedPlan?.planId) });

      if (!plan) {
        details.push(`Error: ${org.name} - plan not found`);
        errorCount++;
        continue;
      }

      const planStartDate = new Date(org.creditBasedPlan?.startDate);
      const nextRenewal = new Date(planStartDate);
      nextRenewal.setMonth(nextRenewal.getMonth() + 1);

      // Fetch an admin for this organization to attribute the action to
      const adminMember = await db.collection("members").findOne({
        orgID: org._id.toString(),
        role: { $in: ["admin", "super_admin"] },
      });

      const historyEntry: PlanHistoryEntry = {
        planId: org.creditBasedPlan?.planId,
        planName: plan.name,
        schemaType: plan.schema,
        startDate: planStartDate,
        endDate: org.creditBasedPlan?.endDate ? new Date(org.creditBasedPlan.endDate) : new Date(),
        action: "Applied Plan",
        appliedBy: adminMember ? adminMember.name : "System Cron",
        appliedByAvatar: adminMember?.image,
        appliedAt: new Date(),
      };

      // Update nested structure with credits
      await db.collection("organizations").updateOne(
        { _id: org._id },
        {
          $set: {
            "creditBasedPlan.creditsRemaining": org.pendingCredits,
            creditBalanceAtRenewal: org.pendingCredits,
            nextRenewalDate: nextRenewal,
            updatedAt: new Date(),
          },
          $unset: { pendingCredits: "" },
          $push: { planHistory: historyEntry },
        } as any
      );

      console.log(`✓ Activated legacy plan for org ${org.name}: ${plan.name} (${org.pendingCredits} credits)`);
      details.push(`Success: ${org.name} - activated legacy ${plan.name} (${org.pendingCredits} credits)`);
      activatedCount++;
    } catch (error) {
      console.error(`Error activating legacy plan for org ${org._id}:`, error);
      details.push(`Error: ${org.name} - ${(error as Error).message}`);
      errorCount++;
    }
  }

  console.log(`\nPlan activation complete:`, { activatedCount, skippedCount, errorCount });

  return {
    total: orgsWithScheduledSwitches.length + orgsWithLegacyPending.length,
    activated: activatedCount,
    skipped: skippedCount,
    errors: errorCount,
    details,
  };
}

/**
 * Mark expired plans and clear nextRenewalDate to prevent future renewals.
 */
async function expireEndedPlans(db: any) {
  console.log("\n--- Processing Expired Plans ---");

  // Use pure UTC for comparisons
  const actualNow = new Date();
  const todayStart = new Date(Date.UTC(
    actualNow.getUTCFullYear(),
    actualNow.getUTCMonth(),
    actualNow.getUTCDate(),
    0, 0, 0, 0
  ));

  // Find orgs with expired plans
  // - Credit-based plans: should have nextRenewalDate to clear
  // - Premium plans: may not have nextRenewalDate, just check endDate
  const orgsToExpire = await db
    .collection("organizations")
    .find({
      $or: [
        // Credit-based plans with expired endDate and nextRenewalDate to clear
        {
          "creditBasedPlan.endDate": { $lte: todayStart },
          nextRenewalDate: { $exists: true, $ne: null },
        },
        // Premium plans with expired endDate (may not have nextRenewalDate)
        {
          "premiumPlan.endDate": { $lte: todayStart },
          "premiumPlan.planId": { $exists: true, $ne: null },
        },
      ],
    })
    .toArray();

  console.log(`Found ${orgsToExpire.length} organizations with expired plans`);

  let expiredCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const details: string[] = [];

  for (const org of orgsToExpire) {
    try {
      // Determine which plan(s) expired using nested structure
      const creditBasedExpired =
        org.creditBasedPlan?.planId &&
        org.creditBasedPlan?.endDate &&
        new Date(org.creditBasedPlan.endDate) <= todayStart;
      const premiumExpired =
        org.premiumPlan?.planId &&
        org.premiumPlan?.endDate &&
        new Date(org.premiumPlan.endDate) <= todayStart;

      const planHistory = (org.planHistory || []) as PlanHistoryEntry[];
      const fieldsToUnset: Record<string, string> = {};
      let anyExpired = false;

      // Process credit-based plan expiration
      if (creditBasedExpired) {
        // Mark credit-based plan for removal
        fieldsToUnset.creditBasedPlan = "";
        fieldsToUnset.nextRenewalDate = "";
        fieldsToUnset.creditBalanceAtRenewal = "";

        console.log(`✓ Credit-based plan expired for org ${org.name}`);
        details.push(`Success: ${org.name} - expired credit-based plan`);
        anyExpired = true;
      }

      // Process premium plan expiration
      if (premiumExpired) {
        // Mark premium plan for removal
        fieldsToUnset.premiumPlan = "";

        console.log(`✓ Premium plan expired for org ${org.name}`);
        details.push(`Success: ${org.name} - expired premium plan`);
        anyExpired = true;
      }

      if (Object.keys(fieldsToUnset).length === 0) {
        console.log(`⏭ Skipping org ${org.name} - nothing to expire`);
        details.push(`Skipped: ${org.name} - no plans to expire`);
        skippedCount++;
        continue;
      }

      // Clear expired plan fields
      await db.collection("organizations").updateOne(
        { _id: org._id },
        {
          $unset: fieldsToUnset,
          $set: { updatedAt: new Date() },
        } as any
      );

      if (anyExpired) {
        expiredCount++;
      }
    } catch (error) {
      console.error(`Error expiring plan for org ${org._id}:`, error);
      details.push(`Error: ${org.name} - ${(error as Error).message}`);
      errorCount++;
    }
  }

  console.log(`\nPlan expiration processing complete:`, { expiredCount, skippedCount, errorCount });

  return {
    total: orgsToExpire.length,
    expired: expiredCount,
    skipped: skippedCount,
    errors: errorCount,
    details,
  };
}

