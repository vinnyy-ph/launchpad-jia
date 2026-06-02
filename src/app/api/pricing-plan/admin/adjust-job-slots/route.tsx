import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { orgId, amount, reason, planType = "premium" } = body;

    // Validate required fields
    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || !Number.isInteger(amount)) {
      return NextResponse.json(
        { error: "Amount must be an integer" },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      return NextResponse.json(
        { error: "Reason is required" },
        { status: 400 }
      );
    }

    if (!["premium", "credit-based"].includes(planType)) {
      return NextResponse.json(
        { error: "Plan type must be 'premium' or 'credit-based'" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Fetch organization
    const organization = await db
      .collection("organizations")
      .findOne({ _id: new ObjectId(orgId) });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Note: Per new design, only premium plans have job slot adjustments
    // Credit-based plans have their limits set directly by the plan
    const isPremium = planType === "premium";
    const nestedPlanField = isPremium ? "premiumPlan" : "creditBasedPlan";
    const jobPostTypeValue = isPremium ? "premium" : "credit-based";
    const planLabel = isPremium ? "premium" : "credit-based";

    // Get nested plan data
    const nestedPlan = organization[nestedPlanField] as { planId?: string; jobSlotAdjustment?: number } | null;

    // Check if organization has the plan
    if (!nestedPlan?.planId) {
      return NextResponse.json(
        { error: `Organization does not have a ${planLabel} plan assigned` },
        { status: 400 }
      );
    }

    // Credit-based plans don't support job slot adjustments
    if (!isPremium) {
      return NextResponse.json(
        { error: "Credit-based plans do not support job slot adjustments. Only premium plans can have slot adjustments." },
        { status: 400 }
      );
    }

    // Fetch the plan to get base max slots
    const plan = await db
      .collection("organization-plans")
      .findOne({ _id: new ObjectId(nestedPlan.planId) });

    if (!plan) {
      return NextResponse.json(
        { error: `${planLabel.charAt(0).toUpperCase() + planLabel.slice(1)} plan not found` },
        { status: 404 }
      );
    }

    // Check if plan has unlimited job posts (null means unlimited)
    if (plan.maxActiveJobPosts === null) {
      return NextResponse.json(
        { error: `Cannot adjust job slots for a plan with unlimited job posts` },
        { status: 400 }
      );
    }

    const baseMaxSlots = plan.maxActiveJobPosts || 0;
    const currentAdjustment = nestedPlan.jobSlotAdjustment || 0;
    const newAdjustment = currentAdjustment + amount;
    const newEffectiveMax = baseMaxSlots + newAdjustment;

    // Count active job posts for this plan type
    const activeJobPosts = await db
      .collection("careers")
      .countDocuments({
        orgID: orgId,
        status: "active",
        jobPostType: jobPostTypeValue,
      });

    // Validate new total doesn't go below active count
    if (newEffectiveMax < activeJobPosts) {
      return NextResponse.json(
        {
          error: `Cannot reduce slots below active job post count. Current active: ${activeJobPosts}, requested effective max: ${newEffectiveMax}`,
        },
        { status: 400 }
      );
    }

    // Validate new total doesn't go negative
    if (newEffectiveMax < 0) {
      return NextResponse.json(
        { error: "Effective max slots cannot be negative" },
        { status: 400 }
      );
    }

    // Update organization with new adjustment in nested structure
    await db.collection("organizations").updateOne(
      { _id: new ObjectId(orgId) },
      {
        $set: {
          "premiumPlan.jobSlotAdjustment": newAdjustment,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      planType,
      previousAdjustment: currentAdjustment,
      newAdjustment,
      baseMaxSlots,
      effectiveMaxSlots: newEffectiveMax,
      activeJobPosts,
    });
  } catch (error) {
    console.error("Error adjusting job slots:", error);
    return NextResponse.json(
      { error: "Error adjusting job slots" },
      { status: 500 }
    );
  }
});

