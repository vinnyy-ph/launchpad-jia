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

    // Fetch all assigned plans using nested plan structure
    const assignedPlans: { creditBased: unknown; premium: unknown } = {
      creditBased: null,
      premium: null,
    };

    if (organization.creditBasedPlan?.planId) {
      assignedPlans.creditBased = await db
        .collection("organization-plans")
        .findOne({ _id: new ObjectId(organization.creditBasedPlan.planId) });
    }

    if (organization.premiumPlan?.planId) {
      assignedPlans.premium = await db
        .collection("organization-plans")
        .findOne({ _id: new ObjectId(organization.premiumPlan.planId) });
    }

    // Determine which plan types are already assigned
    const existingPlanTypes: string[] = [];
    if (assignedPlans.creditBased) existingPlanTypes.push("credit-based");
    if (assignedPlans.premium) existingPlanTypes.push("premium");

    const members = await db
      .collection("members")
      .find({ orgID: orgId })
      .toArray();

    const adminMembers = members.filter(
      (m) => m.role === "admin"
    );

    // Count active job posts by type
    const [creditBasedJobPosts, premiumJobPosts, totalActiveJobPosts] = await Promise.all([
      db.collection("careers").countDocuments({
        orgID: orgId,
        status: "active",
        jobPostType: "credit-based",
      }),
      db.collection("careers").countDocuments({
        orgID: orgId,
        status: "active",
        jobPostType: "premium",
      }),
      db.collection("careers").countDocuments({
        orgID: orgId,
        status: "active",
      }),
    ]);

    let creditsUsed = 0;
    let creditsTotal = 0;

    // Use credit-based plan for credits calculation
    // creditBalanceAtRenewal tracks actual starting balance (including rollover)
    // Falls back to creditsPerMonth for organizations without the field
    const creditPlan = assignedPlans.creditBased as { creditsPerMonth?: number } | null;
    if (creditPlan) {
      creditsTotal = organization.creditBalanceAtRenewal ?? creditPlan.creditsPerMonth ?? 0;
      creditsUsed = Math.max(0, creditsTotal - (organization.creditBasedPlan?.creditsRemaining || 0));
    }

    // Calculate combined admin seats by summing from both plans
    // If either plan has unlimited seats (null), combined is unlimited
    const creditBasedSeats = (assignedPlans.creditBased as { maxAdminSeats?: number | null } | null)?.maxAdminSeats;
    const premiumSeats = (assignedPlans.premium as { maxAdminSeats?: number | null } | null)?.maxAdminSeats;

    let maxAdminSeats: number | null;
    if (creditBasedSeats === null || premiumSeats === null) {
      // If either plan has unlimited seats, combined is unlimited
      maxAdminSeats = null;
    } else if (assignedPlans.creditBased && assignedPlans.premium) {
      // Both plans exist with finite limits - sum them
      maxAdminSeats = (creditBasedSeats ?? 0) + (premiumSeats ?? 0);
    } else if (assignedPlans.creditBased) {
      // Only credit-based plan
      maxAdminSeats = creditBasedSeats === null ? null : (creditBasedSeats ?? 5);
    } else if (assignedPlans.premium) {
      // Only premium plan
      maxAdminSeats = premiumSeats === null ? null : (premiumSeats ?? 5);
    } else {
      // No plans assigned - default to 5
      maxAdminSeats = 5;
    }

    // Determine max job posts from assigned plans
    // Include per-org slot adjustments for each plan type
    // null = unlimited, so only apply adjustment if base is a number
    // Note: Credit-based plans don't have job slot adjustments
    const creditBasedBaseMaxJobPosts = (assignedPlans.creditBased as { maxActiveJobPosts?: number | null } | null)?.maxActiveJobPosts;
    const effectiveCreditBasedMaxJobPosts: number | null = creditBasedBaseMaxJobPosts;

    const premiumBaseMaxJobPosts = (assignedPlans.premium as { maxActiveJobPosts?: number | null } | null)?.maxActiveJobPosts;
    const premiumJobSlotAdjustment = organization.premiumPlan?.jobSlotAdjustment || 0;
    const effectivePremiumMaxJobPosts: number | null = premiumBaseMaxJobPosts === null
      ? null
      : (premiumBaseMaxJobPosts || 0) + premiumJobSlotAdjustment;

    // Sum up effective max job posts from all assigned plans
    // If any plan has unlimited (null), the combined is unlimited
    let maxJobPosts: number | null;
    if (effectiveCreditBasedMaxJobPosts === null || effectivePremiumMaxJobPosts === null) {
      maxJobPosts = null; // Unlimited
    } else {
      maxJobPosts =
        (assignedPlans.creditBased ? effectiveCreditBasedMaxJobPosts : 0) +
        (assignedPlans.premium ? effectivePremiumMaxJobPosts : 0);
    }

    const usage = {
      creditsUsed: creditPlan ? creditsUsed : undefined,
      creditsTotal: creditPlan ? creditsTotal : undefined,
      activeJobPosts: totalActiveJobPosts,
      maxJobPosts,
      adminSeatsUsed: adminMembers.length,
      maxAdminSeats,
      // Per-plan job posts for accurate per-plan display
      perPlanJobPosts: {
        creditBased: creditBasedJobPosts,
        premium: premiumJobPosts,
      },
      // Per-plan admin seats for UI flexibility
      perPlanAdminSeats: {
        creditBased: creditBasedSeats,
        premium: premiumSeats,
      },
    };

    const now = new Date();

    // Check active plan dates from nested structure
    const creditBasedStartDate = organization.creditBasedPlan?.startDate
      ? new Date(organization.creditBasedPlan.startDate)
      : null;
    const creditBasedEndDate = organization.creditBasedPlan?.endDate
      ? new Date(organization.creditBasedPlan.endDate)
      : null;
    const premiumStartDate = organization.premiumPlan?.startDate
      ? new Date(organization.premiumPlan.startDate)
      : null;
    const premiumEndDate = organization.premiumPlan?.endDate
      ? new Date(organization.premiumPlan.endDate)
      : null;

    // Check PENDING plan fields (for scheduled switches)
    const pendingCreditBasedPlanId = organization.pendingCreditBasedPlanId;
    const pendingCreditBasedStartDate = organization.pendingCreditBasedPlanIdStartDate
      ? new Date(organization.pendingCreditBasedPlanIdStartDate)
      : null;
    const pendingPremiumPlanId = organization.pendingPremiumPlanId;
    const pendingPremiumStartDate = organization.pendingPremiumPlanIdStartDate
      ? new Date(organization.pendingPremiumPlanIdStartDate)
      : null;

    // Fetch pending plans if they exist
    let pendingCreditBasedPlan = null;
    let pendingPremiumPlan = null;
    if (pendingCreditBasedPlanId) {
      pendingCreditBasedPlan = await db
        .collection("organization-plans")
        .findOne({ _id: new ObjectId(pendingCreditBasedPlanId) });
    }
    if (pendingPremiumPlanId) {
      pendingPremiumPlan = await db
        .collection("organization-plans")
        .findOne({ _id: new ObjectId(pendingPremiumPlanId) });
    }

    // Determine if there are pending plans (scheduled switches stored in pending fields)
    const hasPendingCreditBasedPlan = !!pendingCreditBasedPlanId;
    const hasPendingPremiumPlan = !!pendingPremiumPlanId;
    const isPlanPending = hasPendingCreditBasedPlan || hasPendingPremiumPlan;

    // Determine if active plans are expired (end date in past)
    const isCreditBasedPlanExpired = creditBasedEndDate ? creditBasedEndDate < now : false;
    const isPremiumPlanExpired = premiumEndDate ? premiumEndDate < now : false;

    // hasPlan is true if there's any assigned plan
    const hasPlan = !!(assignedPlans.creditBased || assignedPlans.premium);

    // isPlanExpired only if ALL assigned plans are expired
    const isPlanExpired = hasPlan && (
      (assignedPlans.creditBased && isCreditBasedPlanExpired && !assignedPlans.premium) ||
      (assignedPlans.premium && isPremiumPlanExpired && !assignedPlans.creditBased) ||
      (assignedPlans.creditBased && assignedPlans.premium && isCreditBasedPlanExpired && isPremiumPlanExpired)
    );

    // Pending plan details for UI (from pending fields)
    const pendingPlanInfo = isPlanPending
      ? {
        pendingCredits: organization.pendingCredits,
        activationDate: hasPendingCreditBasedPlan
          ? pendingCreditBasedStartDate
          : pendingPremiumStartDate,
        pendingPlanType: hasPendingCreditBasedPlan ? "credit-based" : "premium",
        pendingPlanName: hasPendingCreditBasedPlan
          ? (pendingCreditBasedPlan as { name?: string } | null)?.name
          : (pendingPremiumPlan as { name?: string } | null)?.name,
        pendingPlanId: hasPendingCreditBasedPlan
          ? pendingCreditBasedPlanId
          : pendingPremiumPlanId,
      }
      : undefined;

    // Enhance assignedPlans with effective max job posts for UI
    // Active plans are never "pending" - pending plans are stored in separate fields
    const enhancedAssignedPlans = {
      ...assignedPlans,
      creditBased: assignedPlans.creditBased
        ? {
          ...(assignedPlans.creditBased as object),
          // Include effective max (no adjustment for credit-based plans)
          effectiveMaxActiveJobPosts: effectiveCreditBasedMaxJobPosts,
          // Active plans are not pending - pending plans are stored separately
          isPending: false,
        }
        : null,
      premium: assignedPlans.premium
        ? {
          ...(assignedPlans.premium as object),
          // Include effective max that accounts for per-org adjustment
          effectiveMaxActiveJobPosts: effectivePremiumMaxJobPosts,
          jobSlotAdjustment: premiumJobSlotAdjustment,
          // Active plans are not pending - pending plans are stored separately
          isPending: false,
        }
        : null,
    };

    return NextResponse.json({
      organization,
      usage,
      hasPlan,
      isPlanExpired,
      isPlanPending,
      pendingPlanInfo,
      assignedPlans: enhancedAssignedPlans,
      existingPlanTypes,
    });
  } catch (error) {
    console.error("Error fetching org plan details:", error);
    return NextResponse.json(
      { error: "Error fetching organization plan details" },
      { status: 500 }
    );
  }
});
