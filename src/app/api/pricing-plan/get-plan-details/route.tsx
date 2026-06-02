import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { CREDIT_THRESHOLDS } from "@/lib/utils/constants";
import { verifyUserIsMember } from "@/lib/utils/adminAuth";

// Inlined from planUtils.ts
const calculateCreditBalance = (organization: any, assignedPlans: any) => {
  const creditPlan = assignedPlans?.creditBased;
  if (!creditPlan) {
    return {
      balance: 0,
      total: 0,
      isLowCredit: false,
      isInsufficient: false,
      hasCreditBasedPlan: false,
      isUnlimited: false,
    };
  }
  const totalCredits = organization.creditBalanceAtRenewal ?? creditPlan.creditsPerMonth ?? 0;
  const balance = organization.creditBasedPlan?.creditsRemaining ?? 0;
  const lowCreditThreshold = Math.ceil(totalCredits * 0.2);
  const isLowCredit = balance > 0 && balance <= lowCreditThreshold;
  const isInsufficient = balance <= 0;
  return {
    balance,
    total: totalCredits,
    isLowCredit,
    isInsufficient,
    hasCreditBasedPlan: true,
    isUnlimited: totalCredits === 0,
  };
};

const calculateJobPostLimits = (organization: any, assignedPlans: any) => {
  const creditBasedPlan = assignedPlans?.creditBased;
  const premiumPlan = assignedPlans?.premium;

  const creditBasedBaseLimit = creditBasedPlan?.maxActiveJobPosts;
  const effectiveCreditBasedLimit = creditBasedBaseLimit === null ? null : (creditBasedBaseLimit || 0);

  const premiumBaseLimit = premiumPlan?.maxActiveJobPosts;
  const premiumAdjustment = organization.premiumPlan?.jobSlotAdjustment ?? 0;
  const effectivePremiumLimit = premiumBaseLimit === null ? null : (premiumBaseLimit || 0) + premiumAdjustment;

  let totalLimit: number | null = 0;
  if (effectiveCreditBasedLimit === null || effectivePremiumLimit === null) {
    totalLimit = null;
  } else {
    totalLimit = (effectiveCreditBasedLimit || 0) + (effectivePremiumLimit || 0);
  }

  return {
    creditBased: {
      base: creditBasedBaseLimit ?? null,
      adjustment: 0,
      effective: effectiveCreditBasedLimit,
      isUnlimited: creditBasedBaseLimit === null,
    },
    premium: {
      base: premiumBaseLimit ?? null,
      adjustment: premiumAdjustment,
      effective: effectivePremiumLimit,
      isUnlimited: premiumBaseLimit === null,
    },
    total: {
      limit: totalLimit,
      isUnlimited: totalLimit === null,
    },
  };
};

const getJobPostLimitStatus = (organization: any, assignedPlans: any, usedCount: number, jobPostType?: 'credit-based' | 'premium') => {
  const limits = calculateJobPostLimits(organization, assignedPlans);
  if (jobPostType === 'credit-based') {
    const creditLimit = limits.creditBased;
    return {
      used: usedCount,
      limit: creditLimit.effective,
      isUnlimited: creditLimit.isUnlimited,
      isOverLimit: !creditLimit.isUnlimited && usedCount >= creditLimit.effective,
      percentage: creditLimit.effective > 0 ? Math.round((usedCount / creditLimit.effective) * 100) : 0,
    };
  }
  if (jobPostType === 'premium') {
    const premiumLimit = limits.premium;
    return {
      used: usedCount,
      limit: premiumLimit.effective,
      isUnlimited: premiumLimit.isUnlimited,
      isOverLimit: !premiumLimit.isUnlimited && usedCount >= premiumLimit.effective,
      percentage: premiumLimit.effective > 0 ? Math.round((usedCount / premiumLimit.effective) * 100) : 0,
    };
  }
  const totalLimit = limits.total;
  return {
    used: usedCount,
    limit: totalLimit.limit,
    isUnlimited: totalLimit.isUnlimited,
    isOverLimit: !totalLimit.isUnlimited && usedCount >= totalLimit.limit,
    percentage: totalLimit.limit > 0 ? Math.round((usedCount / totalLimit.limit) * 100) : 0,
  };
};

const calculateAdminSeatLimits = (organization: any, assignedPlans: any) => {
  const creditBasedPlan = assignedPlans?.creditBased;
  const premiumPlan = assignedPlans?.premium;

  // A plan contributes to unlimited if it EXISTS and its limit is null or undefined
  const creditIsUnlimited = !!creditBasedPlan && (creditBasedPlan.maxAdminSeats === null || creditBasedPlan.maxAdminSeats === undefined);
  const premiumIsUnlimited = !!premiumPlan && (premiumPlan.maxAdminSeats === null || premiumPlan.maxAdminSeats === undefined);

  const creditBasedLimit = creditBasedPlan?.maxAdminSeats || 0;
  const premiumLimit = premiumPlan?.maxAdminSeats || 0;

  let effectiveLimit: number | null = 0;
  let isUnlimited = false;

  // If ANY active plan is unlimited, the combined limit is unlimited
  if (creditIsUnlimited || premiumIsUnlimited) {
    isUnlimited = true;
    effectiveLimit = null;
  }
  // Otherwise, sum the limits from active plans
  else {
    effectiveLimit = (creditBasedPlan ? (creditBasedLimit || 0) : 0) + (premiumPlan ? (premiumLimit || 0) : 0);
  }

  return {
    creditBased: {
      limit: creditBasedPlan ? creditBasedLimit : 0,
      isUnlimited: creditIsUnlimited
    },
    premium: {
      limit: premiumPlan ? premiumLimit : 0,
      isUnlimited: premiumIsUnlimited
    },
    combined: { limit: effectiveLimit, isUnlimited },
  };
};

const getAdminSeatLimitStatus = (organization: any, assignedPlans: any, adminCount: number) => {
  const limits = calculateAdminSeatLimits(organization, assignedPlans);
  const combinedLimit = limits.combined;
  return {
    used: adminCount,
    limit: combinedLimit.limit,
    isUnlimited: combinedLimit.isUnlimited,
    isOverLimit: !combinedLimit.isUnlimited && combinedLimit.limit !== null && adminCount > combinedLimit.limit,
    percentage: combinedLimit.limit && combinedLimit.limit > 0 ? Math.round((adminCount / combinedLimit.limit) * 100) : 0,
    limits, // Include per-plan limits
  };
};

const aggregatePlanUsage = (organization: any, assignedPlans: any, usageData: {
  creditsUsed?: number;
  activeJobPosts?: number;
  adminSeatsUsed?: number;
  creditBasedJobPosts?: number;
  premiumJobPosts?: number;
}) => {
  const creditInfo = calculateCreditBalance(organization, assignedPlans);
  const creditBasedJobPostStatus = getJobPostLimitStatus(organization, assignedPlans, usageData.creditBasedJobPosts || 0, 'credit-based');
  const premiumJobPostStatus = getJobPostLimitStatus(organization, assignedPlans, usageData.premiumJobPosts || 0, 'premium');
  const totalJobPostStatus = getJobPostLimitStatus(organization, assignedPlans, usageData.activeJobPosts || 0);
  const adminSeatStatus = getAdminSeatLimitStatus(organization, assignedPlans, usageData.adminSeatsUsed || 0);
  return {
    credits: { ...creditInfo, used: usageData.creditsUsed || 0 },
    jobPosts: {
      creditBased: { ...creditBasedJobPostStatus, used: usageData.creditBasedJobPosts || 0 },
      premium: { ...premiumJobPostStatus, used: usageData.premiumJobPosts || 0 },
      total: { ...totalJobPostStatus, used: usageData.activeJobPosts || 0 },
    },
    adminSeats: adminSeatStatus,
    summary: {
      hasCreditBasedPlan: !!assignedPlans?.creditBased,
      hasPremiumPlan: !!assignedPlans?.premium,
      hasAnyLimits: !creditInfo.isUnlimited || !totalJobPostStatus.isUnlimited || !adminSeatStatus.isUnlimited,
      isOverAnyLimits: creditInfo.isInsufficient || totalJobPostStatus.isOverLimit || adminSeatStatus.isOverLimit,
    },
  };
};

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
        { error: "Organization ID not found. Please ensure you are associated with an organization." },
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

    const organization = await db
      .collection("organizations")
      .findOne({ _id: orgObjectId });

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

    // Fetch all assigned plans using nested structure
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

    // Count admin members
    const members = await db
      .collection("members")
      .find({ orgID: userOrgId })
      .toArray();

    const adminMembers = members.filter(
      (m) => m.role === "admin"
    );

    // Count active job posts by type
    const [creditBasedJobPosts, premiumJobPosts, totalActiveJobPosts] = await Promise.all([
      db.collection("careers").countDocuments({
        orgID: userOrgId,
        status: "active",
        jobPostType: "credit-based",
      }),
      db.collection("careers").countDocuments({
        orgID: userOrgId,
        status: "active",
        jobPostType: "premium",
      }),
      db.collection("careers").countDocuments({
        orgID: userOrgId,
        status: "active",
      }),
    ]);

    // Validate plan start dates and filter out future-dated plans (Abstracting from recruiter view)
    const now = new Date();
    const BUFFER_MS = 14 * 60 * 60 * 1000;
    const nowWithBuffer = new Date(now.getTime() + BUFFER_MS);

    let isCreditPlanActive = false;
    if (assignedPlans.creditBased && organization.creditBasedPlan?.startDate) {
      const startDate = new Date(organization.creditBasedPlan.startDate);
      if (startDate > nowWithBuffer) {
        assignedPlans.creditBased = null; // Hide future plan
      } else {
        isCreditPlanActive = true;
      }
    }

    let isPremiumActive = false;
    if (assignedPlans.premium && organization.premiumPlan?.startDate) {
      const startDate = new Date(organization.premiumPlan.startDate);
      if (startDate > nowWithBuffer) {
        assignedPlans.premium = null; // Hide future plan
      } else {
        isPremiumActive = true;
      }
    }

    // Use centralized utility to aggregate plan usage
    const creditsPerMonth = (assignedPlans.creditBased as any)?.creditsPerMonth || 0;
    const creditsTotal = organization.creditBalanceAtRenewal ?? creditsPerMonth;

    // Only show credits if plan is active
    const creditsRemaining = isCreditPlanActive
      ? (organization.creditBasedPlan?.creditsRemaining || 0)
      : 0;

    const creditsUsed = creditsRemaining ? Math.max(0, creditsTotal - creditsRemaining) : 0;

    const usageData = {
      creditsUsed,
      activeJobPosts: totalActiveJobPosts,
      adminSeatsUsed: adminMembers.length,
      creditBasedJobPosts: creditBasedJobPosts,
      premiumJobPosts: premiumJobPosts,
    };

    const aggregatedUsage = aggregatePlanUsage(organization, assignedPlans, usageData);

    const usage = {
      creditsUsed: aggregatedUsage.credits.used,
      creditsTotal: aggregatedUsage.credits.total,
      activeJobPosts: aggregatedUsage.jobPosts.total.used,
      maxJobPosts: aggregatedUsage.jobPosts.total.limit,
      // Per-plan job posts for accurate per-plan display
      perPlanJobPosts: {
        creditBased: aggregatedUsage.jobPosts.creditBased.used,
        premium: aggregatedUsage.jobPosts.premium.used,
      },
      adminSeatsUsed: aggregatedUsage.adminSeats.used,
      maxAdminSeats: aggregatedUsage.adminSeats.limit,
      // Per-plan admin seats for UI flexibility
      perPlanAdminSeats: {
        creditBased: (aggregatedUsage.adminSeats as any).limits.creditBased.limit,
        premium: (aggregatedUsage.adminSeats as any).limits.premium.limit,
      },
    };

    const hasPlan = !!(
      assignedPlans.creditBased ||
      assignedPlans.premium
    );

    // Determine overall plan status - with filtering, this will practically be "active" or "none"
    let planStatus: "active" | "pending" | "expired" | "none" = "none";

    if (hasPlan) {
      // If we filtered out future plans, any remaining plan is active
      planStatus = "active";
    }

    // Prepare organization object with hidden future plans
    const responseOrganization = {
      _id: organization._id.toString(),
      creditsRemaining,
      nextRenewalDate: organization.nextRenewalDate,
      creditBasedPlan: isCreditPlanActive ? organization.creditBasedPlan : undefined,
      premiumPlan: isPremiumActive ? organization.premiumPlan : undefined,
    };

    // Calculate credit status flags
    const isLowCredit = creditsRemaining <= CREDIT_THRESHOLDS.LOW_BALANCE;
    const isInsufficient = creditsRemaining < CREDIT_THRESHOLDS.INSUFFICIENT;

    // Enhance assignedPlans with effective max job posts for UI using centralized data
    const enhancedAssignedPlans = {
      ...assignedPlans,
      creditBased: assignedPlans.creditBased
        ? {
          ...(assignedPlans.creditBased as object),
          // Include effective max (no adjustment for credit-based plans)
          effectiveMaxActiveJobPosts: aggregatedUsage.jobPosts.creditBased.limit,
        }
        : null,
      premium: assignedPlans.premium
        ? {
          ...(assignedPlans.premium as object),
          // Include effective max that accounts for per-org adjustment
          effectiveMaxActiveJobPosts: aggregatedUsage.jobPosts.premium.limit,
          jobSlotAdjustment: organization.premiumPlan?.jobSlotAdjustment || 0,
        }
        : null,
    };

    return NextResponse.json({
      organization: responseOrganization,
      assignedPlans: enhancedAssignedPlans,
      usage,
      hasPlan,
      planStatus,
      // Credit status flags for low credit warnings
      creditStatus: {
        balance: creditsRemaining,
        isLowCredit,
        isInsufficient,
      },
    });
  } catch (error) {
    console.error("Error fetching plan details:", error);
    return NextResponse.json(
      { error: "Error fetching plan details" },
      { status: 500 }
    );
  }
});

