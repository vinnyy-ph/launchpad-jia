import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { PlanHistoryEntry } from "@/lib/types/organization";

// Inlined from planUtils.ts
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

export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { orgId, schemaType } = body;

    if (!orgId || !schemaType) {
      console.error("[cancel-pending-plan] Missing required data: orgId or schemaType");
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

    // Use centralized field utilities for scheduled plan switches
    const isCreditBased = schemaType === "credit-based";
    const planFields = getPlanFields(schemaType);

    const pendingPlanId = organization[planFields.pendingPlanId];

    if (!pendingPlanId) {
      return NextResponse.json(
        { error: `Organization has no pending ${schemaType} plan to cancel` },
        { status: 400 }
      );
    }

    const pendingPlanStartDate = organization[planFields.pendingStartDate]
      ? new Date(organization[planFields.pendingStartDate])
      : null;
    const pendingPlanEndDate = organization[planFields.pendingEndDate]
      ? new Date(organization[planFields.pendingEndDate])
      : null;

    // Fetch plan details for history entry
    const plan = await db
      .collection("organization-plans")
      .findOne({ _id: new ObjectId(pendingPlanId) });

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



    // Build unset fields to clear the PENDING plan fields
    const unsetFields: Record<string, string> = {
      [planFields.pendingPlanId]: "",
      [planFields.pendingStartDate]: "",
      [planFields.pendingEndDate]: "",
    };

    // Clear pendingCredits if this was a credit-based plan
    if (isCreditBased && organization.pendingCredits !== undefined) {
      unsetFields.pendingCredits = "";
    }

    // Restore original end date if it exists using centralized utility
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    const backupField = planFields.originalEndDate;

    // Determine which plan was shortened when this pending plan was applied
    const shortenedSchema = organization[planFields.pendingShortenedSchema] || schemaType;
    const shortenedFields = getPlanFields(shortenedSchema);
    const shortenedNestedField = shortenedSchema === "credit-based" ? "creditBasedPlan" : "premiumPlan";

    // Get shortened plan details for history entry
    const shortenedPlanId = organization[shortenedNestedField]?.planId;
    const shortenedPlan = shortenedPlanId ? await db.collection("organization-plans").findOne({ _id: new ObjectId(shortenedPlanId) }) : null;

    const updateOperation: Record<string, unknown> = {
      $set: updateFields,
      $unset: unsetFields,
    };

    if (organization[backupField]) {
      const originalDate = organization[backupField];
      updateFields[shortenedFields.endDate] = originalDate;
      updateFields[`${shortenedNestedField}.endDate`] = originalDate;

      // Build history entry for the restoration of the previous plan's schedule
      const historyEntry: PlanHistoryEntry = {
        planId: shortenedPlanId || "",
        planName: shortenedPlan?.name || "Unknown",
        schemaType: shortenedSchema as "credit-based" | "premium",
        startDate: organization[shortenedNestedField]?.startDate || new Date(),
        endDate: originalDate,
        action: "Edited Plan Schedule",
        appliedBy: appliedByName,
        appliedByAvatar,
        appliedAt: new Date(),
      };

      updateOperation.$push = { planHistory: historyEntry };

      unsetFields[backupField] = ""; // Clear the backup field
      unsetFields[planFields.pendingShortenedSchema] = ""; // Clear the schema record
    }



    const result = await db.collection("organizations").updateOne(
      { _id: new ObjectId(orgId) },
      updateOperation as any
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: "Failed to cancel pending plan" },
        { status: 500 }
      );
    }

    const updatedOrg = await db
      .collection("organizations")
      .findOne({ _id: new ObjectId(orgId) });

    return NextResponse.json({
      success: true,
      organization: updatedOrg,
      message: `Pending ${plan?.name || schemaType} plan cancelled successfully`,
    });
  } catch (error) {
    console.error("Error cancelling pending plan:", error);
    return NextResponse.json(
      { error: "Error cancelling pending plan" },
      { status: 500 }
    );
  }
});
