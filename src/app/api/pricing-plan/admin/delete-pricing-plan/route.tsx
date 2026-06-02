import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("planId");

    if (!planId) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Check if any organizations are using this plan (active or pending/scheduled)
    // Organizations reference plans via nested structure: creditBasedPlan.planId, premiumPlan.planId
    // Also check pending plans for scheduled transitions
    const subscriberCount = await db.collection("organizations").countDocuments({
      $or: [
        { "creditBasedPlan.planId": planId },
        { "premiumPlan.planId": planId },
        { "pendingCreditBasedPlan.planId": planId },
        { "pendingPremiumPlan.planId": planId },
      ],
    });

    if (subscriberCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete plan. ${subscriberCount} organization(s) are currently subscribed to this plan.`,
          subscriberCount,
        },
        { status: 400 }
      );
    }

    const result = await db.collection("organization-plans").deleteOne({
      _id: new ObjectId(planId),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Plan deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting pricing plan:", error);
    return NextResponse.json(
      { error: "Error deleting pricing plan" },
      { status: 500 }
    );
  }
});
