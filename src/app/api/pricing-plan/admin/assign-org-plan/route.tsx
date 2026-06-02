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
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ));
}

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { orgId, planId, startDate, endDate } = body;

    if (!orgId || !planId || !startDate || !endDate) {
      console.error("[assign-org-plan] Missing required data: orgId, planId, startDate, or endDate");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    // Parse dates as pure UTC to prevent timezone contamination
    const start = parseUTCDate(startDate)!;
    const end = parseUTCDate(endDate)!;

    if (end <= start) {
      return NextResponse.json(
        { error: "End date must be after start date" },
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

    const plan = await db
      .collection("organization-plans")
      .findOne({ _id: new ObjectId(planId) });

    if (!plan) {
      return NextResponse.json(
        { error: "Pricing plan not found" },
        { status: 404 }
      );
    }

    if (plan.status !== "published") {
      return NextResponse.json(
        { error: "Cannot assign unpublished plan" },
        { status: 400 }
      );
    }

    // Check if org already has a plan of this type using nested structure
    const nestedPlanField = plan.schema === "credit-based" ? "creditBasedPlan" : "premiumPlan";
    const existingNestedPlan = organization[nestedPlanField] as { planId?: string; startDate?: Date; endDate?: Date } | null;

    let endedPlanHistoryEntry: PlanHistoryEntry | null = null;

    // Check if this is a future-dated plan assignment
    const now = new Date();
    // Use 14h buffer to account for timezones ahead of UTC (up to UTC+14)
    const BUFFER_MS = 14 * 60 * 60 * 1000;
    const isFuturePlan = start.getTime() > (now.getTime() + BUFFER_MS);

    if (existingNestedPlan?.planId) {
      // Check if the existing plan allows a new assignment:
      // 1. Plan has already ended (end date in the past), OR
      // 2. New plan starts on or after the existing plan's end date (scheduled switch)
      const existingEndDate = existingNestedPlan.endDate;
      const existingStartDate = existingNestedPlan.startDate;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingEndDateObj = existingEndDate ? new Date(existingEndDate) : null;
      if (existingEndDateObj) existingEndDateObj.setHours(0, 0, 0, 0);

      const startDateNormalized = new Date(start);
      startDateNormalized.setHours(0, 0, 0, 0);

      const hasEnded = existingEndDateObj && existingEndDateObj < today;
      const isValidScheduledSwitch = existingEndDateObj && startDateNormalized >= existingEndDateObj;

      if (!hasEnded && !isValidScheduledSwitch) {
        return NextResponse.json(
          { error: `Organization already has an active ${plan.schema} plan assigned. End the current plan first.` },
          { status: 400 }
        );
      }

      // Plan has ended or is being replaced - record it in history before overwriting
      const endedPlan = await db
        .collection("organization-plans")
        .findOne({ _id: new ObjectId(existingNestedPlan.planId) });

      if (endedPlan) {
        endedPlanHistoryEntry = {
          planId: existingNestedPlan.planId,
          planName: endedPlan.name || "Unknown Plan",
          schemaType: endedPlan.schema || plan.schema,
          startDate: existingStartDate ? new Date(existingStartDate) : new Date(),
          endDate: existingEndDateObj || new Date(),
          // If we are shortening the current plan for a future switch, it's a schedule edit.
          // If we are replacing it immediately, it's a plan change (Applied).
          action: isFuturePlan ? "Edited Plan Schedule" : "Applied Plan",
          appliedBy: "System (Plan Replaced)",
          appliedAt: new Date(),
        };
      }
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



    // Check if there's an active current plan of the same type (not yet ended)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentPlanEndDate = existingNestedPlan?.endDate ? new Date(existingNestedPlan.endDate) : null;
    if (currentPlanEndDate) currentPlanEndDate.setHours(0, 0, 0, 0);
    const hasActiveCurrentPlan = existingNestedPlan?.planId && currentPlanEndDate && currentPlanEndDate >= today;

    // Determine if this is a scheduled assignment (future plan)
    // We treat ANY future plan as scheduled, even if there is no current active plan
    const isScheduledSwitch = isFuturePlan;

    const historyEntry: PlanHistoryEntry = {
      planId: planId,
      planName: plan.name,
      schemaType: plan.schema,
      startDate: start,
      endDate: end,
      action: "Applied Plan",
      appliedBy: appliedByName,
      appliedByAvatar,
      appliedAt: new Date(),
    };

    // Determine which fields to update based on whether this is a scheduled switch
    // For scheduled switches, use PENDING fields to preserve the active plan
    const pendingPlanTypeField = plan.schema === "credit-based" ? "pendingCreditBasedPlanId" : "pendingPremiumPlanId";
    const pendingPlanStartField = plan.schema === "credit-based" ? "pendingCreditBasedPlanIdStartDate" : "pendingPremiumPlanIdStartDate";
    const pendingPlanEndField = plan.schema === "credit-based" ? "pendingCreditBasedPlanIdEndDate" : "pendingPremiumPlanIdEndDate";

    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (isScheduledSwitch) {
      // Scheduled switch: Store new plan in PENDING fields, keep current plan active
      updateFields[pendingPlanTypeField] = planId;
      updateFields[pendingPlanStartField] = start;
      updateFields[pendingPlanEndField] = end;
      // Store creator info for plan history when activated by cron
      const creatorField = plan.schema === "credit-based" ? "pendingCreditBasedPlanCreatedBy" : "pendingPremiumPlanCreatedBy";
      const creatorAvatarField = plan.schema === "credit-based" ? "pendingCreditBasedPlanCreatedByAvatar" : "pendingPremiumPlanCreatedByAvatar";
      updateFields[creatorField] = appliedByName;
      updateFields[creatorAvatarField] = appliedByAvatar;

      if (plan.schema === "credit-based") {
        updateFields.pendingCredits = plan.creditsPerMonth || 0;
      }
    } else {
      // Immediate assignment or replacing an ended plan: Write to nested structure
      if (plan.schema === "credit-based") {
        const credits = plan.creditsPerMonth || 0;
        updateFields.creditBasedPlan = {
          planId,
          startDate: start,
          endDate: end,
          creditsRemaining: isFuturePlan ? 0 : credits,
        };

        if (isFuturePlan) {
          // Future plan with no active current plan: store credits as pending
          updateFields.pendingCredits = credits;
        } else {
          // Immediate plan: activate credits now
          updateFields.creditBalanceAtRenewal = credits;
          const nextRenewal = new Date(start);
          nextRenewal.setMonth(nextRenewal.getMonth() + 1);
          updateFields.nextRenewalDate = nextRenewal;
        }
      } else {
        // Premium plan
        updateFields.premiumPlan = {
          planId,
          startDate: start,
          endDate: end,
          jobSlotAdjustment: 0,
        };
      }
    }

    // Build the history entries to push
    const historyEntriesToPush: PlanHistoryEntry[] = [];
    if (endedPlanHistoryEntry) {
      historyEntriesToPush.push(endedPlanHistoryEntry);
    }
    // Only push history entry for immediately activated plans, not future ones
    if (!isFuturePlan) {
      historyEntriesToPush.push(historyEntry);
    }

    const result = await db.collection("organizations").updateOne(
      { _id: new ObjectId(orgId) },
      {
        $set: updateFields,
        ...(historyEntriesToPush.length > 0 ? { $push: { planHistory: { $each: historyEntriesToPush } } } : {}),
      } as any
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: "Failed to update organization" },
        { status: 500 }
      );
    }

    const updatedOrg = await db
      .collection("organizations")
      .findOne({ _id: new ObjectId(orgId) });

    return NextResponse.json({
      success: true,
      organization: updatedOrg,
      message: isFuturePlan
        ? `${plan.name} plan scheduled to activate on ${start.toLocaleDateString()}`
        : `${plan.name} plan assigned successfully`,
      isPending: isFuturePlan,
    });
  } catch (error) {
    console.error("Error assigning org plan:", error);
    return NextResponse.json(
      { error: "Error assigning organization plan" },
      { status: 500 }
    );
  }
});
