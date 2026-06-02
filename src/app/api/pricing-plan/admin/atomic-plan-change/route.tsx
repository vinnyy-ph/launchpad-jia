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

// Inlined from planUtils.ts
const isScheduledTransition = (startDate: string | Date): boolean => {
  const now = new Date();
  // Parse date as pure UTC
  const start = parseUTCDate(startDate)!;
  // Use 14h buffer to account for timezones ahead of UTC (up to UTC+14)
  const BUFFER_MS = 14 * 60 * 60 * 1000;
  return start.getTime() > (now.getTime() + BUFFER_MS);
};

const getTransitionType = (currentPlan: any, newPlan: any, startDate: string) => {
  const isScheduled = isScheduledTransition(startDate);
  const isDifferentPlan = currentPlan?.name !== newPlan?.name;
  if (isScheduled) {
    return isDifferentPlan ? 'scheduled_change' : 'scheduled_renewal';
  } else {
    return isDifferentPlan ? 'immediate_change' : 'immediate_renewal';
  }
};

const calculateCreditBehavior = (plan: any, startDate: string, isTransition: boolean) => {
  const isCreditBased = plan.schema === 'credit-based';
  const isImmediate = !isScheduledTransition(startDate);
  return {
    shouldActivateCredits: isCreditBased && isImmediate && isTransition,
    shouldSetPendingCredits: isCreditBased && !isImmediate,
    creditAmount: plan.creditsPerMonth || 0,
  };
};

const getPlanFields = (schemaType: 'credit-based' | 'premium') => {
  const isCreditBased = schemaType === 'credit-based';
  return {
    planId: isCreditBased ? 'creditBasedPlanId' : 'premiumPlanId',
    startDate: isCreditBased ? 'creditBasedPlanIdStartDate' : 'premiumPlanIdStartDate',
    endDate: isCreditBased ? 'creditBasedPlanIdEndDate' : 'premiumPlanIdEndDate',
    pendingPlanId: isCreditBased ? 'pendingCreditBasedPlanId' : 'pendingPremiumPlanId',
    pendingStartDate: isCreditBased ? 'pendingCreditBasedPlanIdStartDate' : 'pendingPremiumPlanIdStartDate',
    pendingEndDate: isCreditBased ? 'pendingCreditBasedPlanIdEndDate' : 'pendingPremiumPlanIdEndDate',
    originalEndDate: isCreditBased ? 'originalCreditBasedPlanIdEndDate' : 'originalPremiumPlanIdEndDate',
    pendingShortenedSchema: isCreditBased ? 'pendingCreditBasedPlanShortenedSchema' : 'pendingPremiumPlanShortenedSchema',
  };
};

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  // Extract variables outside try block for error logging
  let orgId: string, currentPlanSchemaType: string, currentPlanEndDate: string,
    newPlanId: string, newPlanStartDate: string, newPlanEndDate: string;

  try {
    const body = await request.json();
    ({
      orgId,
      currentPlanSchemaType,
      currentPlanEndDate,
      newPlanId,
      newPlanStartDate,
      newPlanEndDate
    } = body);

    // Validate required fields
    if (!orgId || !currentPlanSchemaType || !currentPlanEndDate || !newPlanId || !newPlanStartDate || !newPlanEndDate) {
      return NextResponse.json(
        { error: "Missing required fields for plan change" },
        { status: 400 }
      );
    }

    if (currentPlanSchemaType !== "credit-based" && currentPlanSchemaType !== "premium") {
      return NextResponse.json(
        { error: "Invalid current plan schema type" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Get organization and validate it exists
    const organization = await db
      .collection("organizations")
      .findOne({ _id: new ObjectId(orgId) });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Get current plan details using nested structure
    const isCurrentCreditBased = currentPlanSchemaType === "credit-based";
    const currentNestedPlanField = isCurrentCreditBased ? "creditBasedPlan" : "premiumPlan";
    const currentNestedPlan = organization[currentNestedPlanField] as { planId?: string; startDate?: Date; endDate?: Date } | null;

    const currentPlanId = currentNestedPlan?.planId;
    if (!currentPlanId) {
      return NextResponse.json(
        { error: "Organization has no current plan of specified schema type" },
        { status: 400 }
      );
    }

    // Get new plan details
    console.log("Looking for new plan with ID:", newPlanId);
    const newPlan = await db
      .collection("organization-plans")
      .findOne({ _id: new ObjectId(newPlanId) });

    console.log("Found new plan:", newPlan);

    if (!newPlan) {
      return NextResponse.json(
        { error: `New plan not found with ID: ${newPlanId}` },
        { status: 404 }
      );
    }

    // Parse dates as pure UTC to prevent timezone contamination
    const currentEndDate = parseUTCDate(currentPlanEndDate)!;
    const newStartDate = parseUTCDate(newPlanStartDate)!;
    const newEndDate = parseUTCDate(newPlanEndDate)!;
    const today = new Date(Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
      0, 0, 0, 0
    ));

    // Validate date relationships
    if (newStartDate < currentEndDate) {
      return NextResponse.json(
        { error: "New plan start date must be on or after the current plan end date" },
        { status: 400 }
      );
    }

    if (newEndDate <= newStartDate) {
      return NextResponse.json(
        { error: "New plan end date must be after the start date" },
        { status: 400 }
      );
    }

    // Get admin info for history entries
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

    // Get current plan details for history
    const currentPlanDetails = await db
      .collection("organization-plans")
      .findOne({ _id: new ObjectId(currentPlanId) });

    // Check if this is a future-dated scheduled switch
    const isScheduled = isScheduledTransition(newStartDate.toISOString());

    // Prepare history entries
    const historyEntries: PlanHistoryEntry[] = [];

    // Add entry for ending current plan
    historyEntries.push({
      planId: currentPlanId,
      planName: currentPlanDetails?.name || "Unknown",
      schemaType: currentPlanSchemaType,
      startDate: currentNestedPlan?.startDate
        ? new Date(currentNestedPlan.startDate)
        : new Date(),
      endDate: currentEndDate,
      // If we are shortening for a future plan, it's a schedule edit.
      // If we are replacing immediately, it's a plan change.
      action: isScheduled ? "Edited Plan Schedule" : "Applied Plan",
      appliedBy: appliedByName,
      appliedByAvatar,
      appliedAt: new Date(),
    });

    // Only push entry for new plan if it's starting immediately
    if (!isScheduled) {
      // Add entry for assigning new plan
      historyEntries.push({
        planId: newPlanId,
        planName: newPlan.name,
        schemaType: newPlan.schema,
        startDate: newStartDate,
        endDate: newEndDate,
        action: "Applied Plan",
        appliedBy: appliedByName,
        appliedByAvatar,
        appliedAt: new Date(),
      });
    }

    // Check if this is a scheduled transition using centralized utility
    // (isScheduled already declared above)

    // Get transition type for logging
    const transitionType = getTransitionType(currentPlanDetails, newPlan, newStartDate.toISOString());

    // Prepare update operations
    const isNewCreditBased = newPlan.schema === "credit-based";

    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    const unsetFields: Record<string, string> = {};

    if (isScheduled) {
      // Scheduled transition: use pending fields from centralized utility
      const newPlanFields = getPlanFields(newPlan.schema as 'credit-based' | 'premium');
      const currentPlanFields = getPlanFields(currentPlanSchemaType as 'credit-based' | 'premium');

      // Store original end date before updating it
      const backupField = newPlanFields.originalEndDate;
      if (currentNestedPlan?.endDate && !organization[backupField]) {
        updateFields[backupField] = currentNestedPlan.endDate;
      }

      // Store which schema we are shortening so cancellation restoration knows which fields to revert
      updateFields[newPlanFields.pendingShortenedSchema] = currentPlanSchemaType;

      updateFields[newPlanFields.pendingPlanId] = newPlanId;
      updateFields[newPlanFields.pendingStartDate] = newStartDate;
      updateFields[newPlanFields.pendingEndDate] = newEndDate;
      // Store creator info for plan history when activated by cron
      const creatorField = newPlan.schema === "credit-based" ? "pendingCreditBasedPlanCreatedBy" : "pendingPremiumPlanCreatedBy";
      const creatorAvatarField = newPlan.schema === "credit-based" ? "pendingCreditBasedPlanCreatedByAvatar" : "pendingPremiumPlanCreatedByAvatar";
      updateFields[creatorField] = appliedByName;
      updateFields[creatorAvatarField] = appliedByAvatar;

      // Update current plan end dates to show admin-selected end date
      updateFields[`${currentNestedPlanField}.endDate`] = currentEndDate;
      updateFields[currentPlanFields.endDate] = currentEndDate;

      // Use centralized credit behavior logic
      const creditBehavior = calculateCreditBehavior(newPlan, newStartDate.toISOString(), true);
      if (creditBehavior.shouldSetPendingCredits) {
        updateFields.pendingCredits = creditBehavior.creditAmount;
      }

      // Scheduled assignment still uses 'applied' action
      // (no need for separate pending_assignment)
    } else {
      // Immediate transition: write to nested structure
      const newNestedPlanField = isNewCreditBased ? "creditBasedPlan" : "premiumPlan";

      // Handle immediate activation for credit-based plans using centralized logic
      const creditBehavior = calculateCreditBehavior(newPlan, newStartDate.toISOString(), true);

      // Calculate credits to add from previous sources
      let additionalCredits = 0;

      if (isNewCreditBased) {
        // Add frozen credits from previous credit-based plan (if switching from premium)
        if (organization.frozenCredits && organization.frozenCredits > 0) {
          additionalCredits += organization.frozenCredits;
        }

        // Add remaining credits from current credit-based plan (if switching credit→credit)
        if (isCurrentCreditBased && organization.creditBasedPlan?.creditsRemaining) {
          additionalCredits += organization.creditBasedPlan.creditsRemaining;
        }
      }

      if (isNewCreditBased && creditBehavior.shouldActivateCredits) {
        const baseCredits = creditBehavior.creditAmount;
        const totalCredits = baseCredits + additionalCredits;
        updateFields[newNestedPlanField] = {
          planId: newPlanId,
          startDate: newStartDate,
          endDate: newEndDate,
          creditsRemaining: totalCredits,
        };
        updateFields.creditBalanceAtRenewal = totalCredits;
        const nextRenewal = new Date(newStartDate);
        nextRenewal.setMonth(nextRenewal.getMonth() + 1);
        updateFields.nextRenewalDate = nextRenewal;

        // Clear frozen credits since we've added them to the new plan
        if (organization.frozenCredits && organization.frozenCredits > 0) {
          unsetFields.frozenCredits = "";
        }
      } else {
        updateFields[newNestedPlanField] = {
          planId: newPlanId,
          startDate: newStartDate,
          endDate: newEndDate,
          ...(isNewCreditBased ? { creditsRemaining: additionalCredits } : { jobSlotAdjustment: 0 }),
        };

        // Clear frozen credits if switching to credit-based (even without immediate activation)
        if (isNewCreditBased && organization.frozenCredits && organization.frozenCredits > 0) {
          unsetFields.frozenCredits = "";
        }
      }

      // Update current plan end date in nested structure
      // IMPORTANT: Only do this if the current and new plan are of different schema types
      // AND we are not about to unset the current plan field.
      // This avoids MongoDB conflict: you cannot $set a sub-field and $set/$unset the parent.

      // Handle immediate end of current plan (unsetting fields if plan has ended)
      if (currentEndDate <= today) {
        if (isCurrentCreditBased) {
          // Only unset if we're not setting new credit-based plan (avoid conflict)
          if (!(isNewCreditBased && newStartDate <= today)) {
            if (!isNewCreditBased) {
              // Switching credit-based to premium - store frozen credits
              const creditsToFreeze = organization.creditBasedPlan?.creditsRemaining || 0;
              if (creditsToFreeze > 0) {
                updateFields.frozenCredits = creditsToFreeze;
              }
              // Unset entire creditBasedPlan since credits are now in frozenCredits
              unsetFields[currentNestedPlanField] = "";
            } else {
              // Switching to another credit-based plan - unset everything
              // (credits already added to new plan above)
              unsetFields[currentNestedPlanField] = "";
            }
            unsetFields.creditBalanceAtRenewal = "";
          }
        } else {
          // Current plan is premium - unset it entirely
          // Only unset if we're not about to overwrite it (avoid conflict)
          if (currentNestedPlanField !== newNestedPlanField) {
            unsetFields[currentNestedPlanField] = "";
          }
        }

        // Only unset nextRenewalDate if we're not setting a new one (avoid conflict)
        if (!(isNewCreditBased && newStartDate <= today)) {
          unsetFields.nextRenewalDate = "";
        }
      }

      // Check if we're unsetting the current plan (either entirely or sub-fields)
      const isUnsettingCurrent = currentNestedPlanField in unsetFields ||
        `${currentNestedPlanField}.planId` in unsetFields;
      const isOverwritingCurrent = currentNestedPlanField === newNestedPlanField;

      if (!isOverwritingCurrent && !isUnsettingCurrent) {
        updateFields[`${currentNestedPlanField}.endDate`] = currentEndDate;
      }
    }

    // Build the update operation
    const updateOperation: Record<string, any> = {
      $set: updateFields,
      $push: { planHistory: { $each: historyEntries } },
    };

    if (Object.keys(unsetFields).length > 0) {
      updateOperation.$unset = unsetFields;
    }

    // Execute the atomic update
    const result = await db.collection("organizations").updateOne(
      { _id: new ObjectId(orgId) },
      updateOperation as any
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: "Failed to update organization plan" },
        { status: 500 }
      );
    }

    // Get the updated organization
    const updatedOrg = await db
      .collection("organizations")
      .findOne({ _id: new ObjectId(orgId) });

    return NextResponse.json({
      success: true,
      organization: updatedOrg,
      message: `Successfully changed from ${currentPlanDetails?.name || "current plan"} to ${newPlan.name}`,
      currentPlanEnded: currentEndDate <= today,
      newPlanActivated: isNewCreditBased && newStartDate <= today,
    });
  } catch (error) {
    console.error("Error in atomic plan change:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orgId,
      currentPlanSchemaType,
      currentPlanEndDate,
      newPlanId,
      newPlanStartDate,
      newPlanEndDate
    });

    return NextResponse.json(
      {
        error: "Error changing organization plan",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
});
