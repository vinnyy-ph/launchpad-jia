import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const orgId = searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json(
      { error: "Organization ID is required" },
      { status: 400 }
    );
  }

  try {
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

    const planHistory = organization.planHistory || [];

    // Determine current plan IDs from nested structure
    const currentCreditBasedPlanId = organization.creditBasedPlan?.planId;
    const currentPremiumPlanId = organization.premiumPlan?.planId;

    const historyWithCurrentFlag = planHistory.map((entry: any, index: number) => {
      const isCurrent = index === planHistory.length - 1 && (
        (currentCreditBasedPlanId && entry.planId === currentCreditBasedPlanId) ||
        (currentPremiumPlanId && entry.planId === currentPremiumPlanId)
      );
      return {
        ...entry,
        isCurrent,
      };
    });

    return NextResponse.json({
      planHistory: historyWithCurrentFlag.reverse(),
      currentPlanIds: {
        creditBased: currentCreditBasedPlanId,
        premium: currentPremiumPlanId,
      },
    });
  } catch (error) {
    console.error("Error fetching plan history:", error);
    return NextResponse.json(
      { error: "Error fetching plan history" },
      { status: 500 }
    );
  }
});
