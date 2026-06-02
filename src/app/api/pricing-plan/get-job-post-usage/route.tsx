import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { verifyUserIsMember } from "@/lib/utils/adminAuth";

/**
 * GET /api/pricing-plan/get-job-post-usage
 * Returns job post counts per plan type for organization.
 * 
 * Response:
 * {
 *   premium: { used: number, max: number },
 *   creditBased: { used: number, max: number },
 *   noPlan: { used: number },
 *   availableTypes: ("premium" | "credit-based")[]
 * }
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

    // Try to get orgID from query params first (for flexibility)
    const searchParams = request.nextUrl.searchParams;
    let userOrgId = searchParams.get("orgID") || searchParams.get("orgId");

    // If not in query params, try to get from user session
    if (!userOrgId) {
      userOrgId = request.user?.orgID || request.user?.orgId;
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
        { error: "Organization ID not found" },
        { status: 400 }
      );
    }

    // Convert to ObjectId if possible
    let orgObjectId;
    try {
      orgObjectId = new ObjectId(userOrgId);
    } catch {
      return NextResponse.json(
        { error: "Invalid organization ID" },
        { status: 400 }
      );
    }

    // Fetch organization to get plan details
    const organization = await db
      .collection("organizations")
      .findOne({ _id: orgObjectId });

    console.log("[get-job-post-usage] Org data:", {
      id: organization?._id,
      premiumPlan: organization?.premiumPlan,
      creditBasedPlan: organization?.creditBasedPlan,
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const result = await verifyUserIsMember(db, userEmail, userOrgId);
    if (!result.authorized) {
      return NextResponse.json({ error: result.reason }, { status: 403 });
    }

    // Count active careers by jobPostType
    const [premiumCount, creditBasedCount, noPlanCount] = await Promise.all([
      db.collection("careers").countDocuments({
        orgID: userOrgId,
        jobPostType: "premium",
        status: "active",
      }),
      db.collection("careers").countDocuments({
        orgID: userOrgId,
        jobPostType: "credit-based",
        status: "active",
      }),
      db.collection("careers").countDocuments({
        orgID: userOrgId,
        $or: [{ jobPostType: null }, { jobPostType: { $exists: false } }],
        status: "active",
      }),
    ]);

    // For active plan check:
    // 1. startDate <= now (it has already started or starts at midnight UTC)
    // 2. endDate >= startOfToday (stays active through the end date in local time)
    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let premiumMax: number | null = 0;
    let creditBasedMax: number | null = 0;
    const availableTypes: ("premium" | "credit-based")[] = [];

    // Check premium plan - verify it's currently active
    if (organization.premiumPlan?.planId) {
      const premiumPlanStartDate = organization.premiumPlan?.startDate ? new Date(organization.premiumPlan.startDate) : null;
      const premiumPlanEndDate = organization.premiumPlan?.endDate ? new Date(organization.premiumPlan.endDate) : null;

      const isPremiumPlanActive = premiumPlanStartDate && premiumPlanStartDate <= now && (!premiumPlanEndDate || premiumPlanEndDate >= startOfToday);

      if (isPremiumPlanActive) {
        const premiumPlan = await db
          .collection("organization-plans")
          .findOne({ _id: new ObjectId(organization.premiumPlan.planId) });
        if (premiumPlan) {
          // Include per-org slot adjustment for premium plans
          const baseMax = premiumPlan.maxActiveJobPosts;
          const slotAdjustment = organization.premiumPlan?.jobSlotAdjustment || 0;
          premiumMax = baseMax === null ? null : (baseMax || 0) + slotAdjustment;
          availableTypes.push("premium");
        }
      }
    }

    // Check credit-based plan - verify it's currently active
    if (organization.creditBasedPlan?.planId) {
      const creditBasedPlanStartDate = organization.creditBasedPlan?.startDate ? new Date(organization.creditBasedPlan.startDate) : null;
      const creditBasedPlanEndDate = organization.creditBasedPlan?.endDate ? new Date(organization.creditBasedPlan.endDate) : null;

      const isCreditBasedPlanActive = creditBasedPlanStartDate && creditBasedPlanStartDate <= now && (!creditBasedPlanEndDate || creditBasedPlanEndDate >= startOfToday);

      if (isCreditBasedPlanActive) {
        const creditBasedPlan = await db
          .collection("organization-plans")
          .findOne({ _id: new ObjectId(organization.creditBasedPlan.planId) });
        if (creditBasedPlan) {
          // Credit-based plans don't have per-org job slot adjustments
          const baseMax = creditBasedPlan.maxActiveJobPosts;
          creditBasedMax = baseMax;
          availableTypes.push("credit-based");
        }
      }
    }

    return NextResponse.json({
      premium: { used: premiumCount, max: premiumMax },
      creditBased: { used: creditBasedCount, max: creditBasedMax },
      noPlan: { used: noPlanCount },
      availableTypes,
    });
  } catch (error) {
    console.error("Error fetching job post usage:", error);
    return NextResponse.json(
      { error: "Error fetching job post usage" },
      { status: 500 }
    );
  }
});

