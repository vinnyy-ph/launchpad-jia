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

export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { orgId, schemaType, endDate } = body;

    if (!orgId || !schemaType || !endDate) {
      console.error("[end-org-plan] Missing required data: orgId, schemaType, or endDate");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    if (schemaType !== "credit-based" && schemaType !== "premium") {
      return NextResponse.json(
        { error: "schemaType must be 'credit-based' or 'premium'" },
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
    const nestedPlan = organization[nestedPlanField] as { planId?: string; startDate?: Date; endDate?: Date } | null;

    const planId = nestedPlan?.planId;

    if (!planId) {
      return NextResponse.json(
        { error: `Organization has no ${schemaType} plan assigned` },
        { status: 400 }
      );
    }

    // Fetch plan details for history entry
    const plan = await db
      .collection("organization-plans")
      .findOne({ _id: new ObjectId(planId) });

    // Parse date as pure UTC to prevent timezone contamination
    const endDateObj = parseUTCDate(endDate)!;
    const todayStart = new Date(Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
      0, 0, 0, 0
    ));

    // Validate end date is not before or on the same day as start date
    const planStartDate = nestedPlan?.startDate ? parseUTCDate(nestedPlan.startDate) : null;
    if (planStartDate) {
      if (endDateObj <= planStartDate) {
        return NextResponse.json(
          { error: "End date must be after the plan start date" },
          { status: 400 }
        );
      }
    }

    // Important: Use todayStart for immediate end check to be timezone-robust
    const isImmediateEnd = endDateObj <= todayStart;

    // Get admin info for history entry
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

    // Build history entry
    const historyEntry: PlanHistoryEntry = {
      planId,
      planName: plan?.name || "Unknown",
      schemaType,
      startDate: nestedPlan?.startDate
        ? new Date(nestedPlan.startDate)
        : new Date(),
      endDate: endDateObj,
      // If ending immediately, it's a plan change (Applied).
      // If scheduled for future, it's a schedule edit.
      action: isImmediateEnd ? "Applied Plan" : "Edited Plan Schedule",
      appliedBy: appliedByName,
      appliedByAvatar,
      appliedAt: new Date(),
    };

    // Build update operation - update nested structure
    const updateFields: Record<string, unknown> = {
      [`${nestedPlanField}.endDate`]: endDateObj,
      updatedAt: new Date(),
    };

    const unsetFields: Record<string, string> = {};

    if (isImmediateEnd) {
      // Clear nextRenewalDate to stop renewals
      unsetFields.nextRenewalDate = "";
      // Clear nested plan to allow reassignment
      unsetFields[nestedPlanField] = "";
      // Also clear pending credits if any
      if (organization.pendingCredits) {
        unsetFields.pendingCredits = "";
      }
      // For credit-based plans, clear credit balance at renewal
      if (isCreditBased) {
        unsetFields.creditBalanceAtRenewal = "";
      }
    }

    const updateOperation: Record<string, unknown> = {
      $set: updateFields,
      $push: { planHistory: historyEntry },
    };

    if (Object.keys(unsetFields).length > 0) {
      updateOperation.$unset = unsetFields;
    }

    const result = await db.collection("organizations").updateOne(
      { _id: new ObjectId(orgId) },
      updateOperation as any
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
      message: isImmediateEnd
        ? "Plan ended immediately"
        : `Plan scheduled to end on ${endDateObj.toLocaleDateString()}`,
      immediateEnd: isImmediateEnd,
    });
  } catch (error) {
    console.error("Error ending org plan:", error);
    return NextResponse.json(
      { error: "Error ending organization plan" },
      { status: 500 }
    );
  }
});

