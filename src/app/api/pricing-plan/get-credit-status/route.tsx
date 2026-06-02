import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { CREDIT_THRESHOLDS } from "@/lib/utils/constants";

/**
 * GET /api/pricing-plan/get-credit-status
 * Returns the credit balance and status flags for the authenticated user's organization.
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { db } = await connectMongoDB();

    // Get user email from authenticated session
    const userEmail = request.user?.email;
    if (!userEmail) {
      return NextResponse.json(
        { error: "User email not found in session" },
        { status: 401 }
      );
    }

    // Try to get orgID from query params first (for flexibility, same as get-plan-details)
    const searchParams = request.nextUrl.searchParams;
    let userOrgId = searchParams.get("orgID") || searchParams.get("orgId");

    // If not in query params, try to get from user session
    if (!userOrgId) {
      userOrgId = request.user?.orgID || (request.user as any)?.orgId;
    }

    // If still not found, look up from members collection
    if (!userOrgId) {
      const member = await db.collection("members").findOne({ email: userEmail });
      if (member) {
        userOrgId = member.orgID || member.organizationId;
      }
    }

    if (!userOrgId) {
      return NextResponse.json(
        { error: "Organization not found for user" },
        { status: 400 }
      );
    }

    // Convert to ObjectId
    let orgObjectId;
    try {
      orgObjectId = new ObjectId(userOrgId);
    } catch {
      return NextResponse.json(
        { error: "Invalid organization ID" },
        { status: 400 }
      );
    }

    // Fetch organization directly (same pattern as get-plan-details)
    const organization = await db
      .collection("organizations")
      .findOne({ _id: orgObjectId });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check for plans using nested structure
    let hasCreditBasedPlan = false;
    if (organization.creditBasedPlan?.planId) {
      const creditPlan = await db
        .collection("organization-plans")
        .findOne({ _id: new ObjectId(organization.creditBasedPlan.planId) });
      if (creditPlan) {
        hasCreditBasedPlan = true;
      }
    }

    let hasPremiumPlan = false;
    if (organization.premiumPlan?.planId) {
      const premiumPlan = await db
        .collection("organization-plans")
        .findOne({ _id: new ObjectId(organization.premiumPlan.planId) });
      if (premiumPlan) {
        hasPremiumPlan = true;
      }
    }

    // Validate plan dates (start and end)
    const now = new Date();
    const BUFFER_MS = 14 * 60 * 60 * 1000;
    const nowWithBuffer = new Date(now.getTime() + BUFFER_MS);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Credit plan dates
    const creditPlanStartDate = organization.creditBasedPlan?.startDate
      ? new Date(organization.creditBasedPlan.startDate)
      : null;
    const creditPlanEndDate = organization.creditBasedPlan?.endDate
      ? new Date(organization.creditBasedPlan.endDate)
      : null;

    const creditHasStarted = creditPlanStartDate && creditPlanStartDate <= nowWithBuffer;
    const creditIsExpired = creditPlanEndDate && creditPlanEndDate < todayStart;
    const hasActiveCreditBasedPlan = hasCreditBasedPlan && creditHasStarted && !creditIsExpired;

    // Premium plan dates
    const premiumPlanStartDate = organization.premiumPlan?.startDate
      ? new Date(organization.premiumPlan.startDate)
      : null;
    const premiumPlanEndDate = organization.premiumPlan?.endDate
      ? new Date(organization.premiumPlan.endDate)
      : null;

    const premiumHasStarted = premiumPlanStartDate && premiumPlanStartDate <= nowWithBuffer;
    const premiumIsExpired = premiumPlanEndDate && premiumPlanEndDate < todayStart;
    const hasActivePremiumPlan = hasPremiumPlan && premiumHasStarted && !premiumIsExpired;

    const hasAnyActivePlan = hasActiveCreditBasedPlan || hasActivePremiumPlan;

    const balance = hasActiveCreditBasedPlan
      ? (organization.creditBasedPlan?.creditsRemaining || 0)
      : 0;
    const isLowCredit = balance <= CREDIT_THRESHOLDS.LOW_BALANCE;
    const isInsufficient = balance < CREDIT_THRESHOLDS.INSUFFICIENT;

    return NextResponse.json({
      balance,
      isLowCredit,
      isInsufficient,
      hasCreditBasedPlan,
      hasActiveCreditBasedPlan,
      hasPremiumPlan,
      hasActivePremiumPlan,
      hasAnyActivePlan,
      isExpired: (creditIsExpired && !hasActivePremiumPlan) || (premiumIsExpired && !hasActiveCreditBasedPlan),
    });
  } catch (error) {
    console.error("Error fetching credit status:", error);
    return NextResponse.json(
      { error: "Error fetching credit status" },
      { status: 500 }
    );
  }
});

