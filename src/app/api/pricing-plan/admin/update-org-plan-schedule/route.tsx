import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { PlanHistoryEntry } from "@/lib/types/organization";

/**
 * Parse a date input and normalize it to UTC midnight (00:00:00).
 */
function parseUTCDate(dateInput: string | Date | null | undefined): Date | undefined {
  if (!dateInput) return undefined;
  
  const date = new Date(dateInput);
  // Return a new Date object set to UTC midnight
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ));
}

export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { orgId, startDate, endDate, schemaType } = body;

    if (!orgId) {
      return NextResponse.json(
        { error: "orgId is required" },
        { status: 400 }
      );
    }

    if (!schemaType || (schemaType !== "credit-based" && schemaType !== "premium")) {
      return NextResponse.json(
        { error: "schemaType must be 'credit-based' or 'premium'" },
        { status: 400 }
      );
    }

    if (!startDate && !endDate) {
      return NextResponse.json(
        { error: "At least one of startDate or endDate is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    const organization = await db
      .collection("organizations")
      .findOne({ _id: new ObjectId(orgId) });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const isCreditBased = schemaType === "credit-based";
    const nestedPlanField = isCreditBased ? "creditBasedPlan" : "premiumPlan";
    const nestedPlan = organization[nestedPlanField] as { planId?: string; startDate?: Date; endDate?: Date; creditsRemaining?: number } | null;

    const planId = nestedPlan?.planId;

    if (!planId) {
      return NextResponse.json(
        { error: `Organization has no ${schemaType} plan assigned` },
        { status: 400 }
      );
    }

    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Parse dates as pure UTC to prevent timezone contamination
    if (startDate) {
      updateFields[`${nestedPlanField}.startDate`] = parseUTCDate(startDate);
    }
    if (endDate) {
      updateFields[`${nestedPlanField}.endDate`] = parseUTCDate(endDate);
    }

    const existingStart = nestedPlan?.startDate as Date | undefined;
    const existingEnd = nestedPlan?.endDate as Date | undefined;

    const newStart = startDate ? parseUTCDate(startDate) : existingStart;
    const newEnd = endDate ? parseUTCDate(endDate) : existingEnd;

    if (newEnd && newStart && newEnd <= newStart) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 }
      );
    }

    const plan = await db
      .collection("organization-plans")
      .findOne({ _id: new ObjectId(planId) });

    // Check plan activation state
    const now = new Date();
    const BUFFER_MS = 14 * 60 * 60 * 1000;
    const nowWithBuffer = new Date(now.getTime() + BUFFER_MS);

    const hasPendingCredits = organization.pendingCredits && organization.pendingCredits > 0;
    const hasActiveCredits = nestedPlan?.creditsRemaining !== undefined && nestedPlan.creditsRemaining >= 0;
    const hasNextRenewal = !!organization.nextRenewalDate;
    const isCurrentlyActive = (hasActiveCredits || hasNextRenewal) && !hasPendingCredits;
    const isNowActive = newStart && newStart <= nowWithBuffer;
    const isNowFuture = newStart && newStart > nowWithBuffer;

    // Block: Cannot push an active plan's start date to the future
    if (isCurrentlyActive && isNowFuture && startDate) {
      return NextResponse.json(
        {
          error: "Cannot change start date to future for an active plan. The plan is already in use with active credits.",
          hint: "To reschedule this plan, you may need to end it first and assign a new plan with the desired schedule."
        },
        { status: 400 }
      );
    }

    // If rescheduling a pending plan to start now, activate it immediately
    if (hasPendingCredits && isNowActive && plan?.schema === "credit-based") {
      updateFields[`${nestedPlanField}.creditsRemaining`] = organization.pendingCredits;
      // Set creditBalanceAtRenewal for accurate usage tracking
      updateFields.creditBalanceAtRenewal = organization.pendingCredits;
      const nextRenewal = new Date(newStart);
      nextRenewal.setMonth(nextRenewal.getMonth() + 1);
      updateFields.nextRenewalDate = nextRenewal;
    }

    const appliedByEmail = request.user?.email || "unknown";
    const appliedByProfile = appliedByEmail
      ? await db.collection("members").findOne({ email: appliedByEmail })
      : null;

    const appliedByName =
      appliedByProfile?.name ||
      (request.user as any)?.name ||
      (request.user as any)?.display_name ||
      (request.user as any)?.displayName ||
      appliedByEmail.split("@")[0] ||
      "Unknown User";

    const appliedByAvatar =
      appliedByProfile?.image ||
      (request.user as any)?.picture ||
      (request.user as any)?.photo_url ||
      (request.user as any)?.photoURL ||
      undefined;

    // Determine if this edit also activates a pending plan
    const activatingPendingPlan = hasPendingCredits && isNowActive && plan?.schema === "credit-based";

    const historyEntry: PlanHistoryEntry = {
      planId,
      planName: plan?.name || "Unknown",
      schemaType: plan?.schema || schemaType,
      startDate: newStart!,
      endDate: newEnd!,
      action: "Edited Plan Schedule",
      appliedBy: appliedByName,
      appliedByAvatar,
      appliedAt: new Date(),
    };

    // Build update operation
    const updateOperation: Record<string, unknown> = {
      $set: updateFields,
    };

    // Only push history for currently active plans (or plans being activated now)
    if (isCurrentlyActive || isNowActive) {
      updateOperation.$push = { planHistory: historyEntry };
    }

    // If activating a pending plan, also clear pendingCredits
    if (activatingPendingPlan) {
      updateOperation.$unset = { pendingCredits: "" };
      // No separate activation entry needed - schedule_edited covers it
    }

    const result = await db.collection("organizations").updateOne(
      { _id: new ObjectId(orgId) },
      updateOperation as any
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: "Failed to update organization schedule" },
        { status: 500 }
      );
    }

    const updatedOrg = await db
      .collection("organizations")
      .findOne({ _id: new ObjectId(orgId) });

    return NextResponse.json({
      success: true,
      organization: updatedOrg,
      activated: activatingPendingPlan,
      message: activatingPendingPlan
        ? `Schedule updated and ${plan?.name} plan activated`
        : "Schedule updated successfully",
    });
  } catch (error) {
    console.error("Error updating org plan schedule:", error);
    return NextResponse.json(
      { error: "Error updating organization plan schedule" },
      { status: 500 }
    );
  }
});
