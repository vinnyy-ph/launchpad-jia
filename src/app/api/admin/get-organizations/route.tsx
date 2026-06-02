import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const GET = withAuth(async (request: AuthenticatedRequest) => {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const filterStatus = searchParams.get("filterStatus");
    const sortBy = searchParams.get("sortBy");

    let defaultSort: any = {
        updatedAt: -1
    };

    if (sortBy === "Oldest Activity") {
        defaultSort = {
            updatedAt: 1
        };
    }
    if (sortBy === "Alphabetical (A-Z)") {
        defaultSort = {
            nameLower: 1
        };
    }
    if (sortBy === "Alphabetical (Z-A)") {
        defaultSort = {
            nameLower: -1
        };
    }

    let filter: any = {
        status: { $in: ["active", "inactive"] }
    };
    if (search) {
        filter.name = { $regex: search, $options: "i" };
    }
    if (filterStatus && filterStatus !== "All Statuses") {
        filter.status = filterStatus.toLowerCase();
    }

    try {
        const { db } = await connectMongoDB();
        const organizations = await db.collection("organizations").aggregate([
            {
                $match: filter
            },
            {
                $lookup: {
                    from: "careers",
                    let: { orgID: { $toString: "$_id" } },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$orgID", "$$orgID"] },
                                        { $eq: ["$status", "active"] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "careers"
                }
            },
            {
                $lookup: {
                    from: "members",
                    let: { orgID: { $toString: "$_id" } },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$orgID", "$$orgID"] }
                            }
                        }
                    ],
                    as: "members"
                }
            },
            {
                $lookup: {
                    from: "organization-plans",
                    let: { creditBasedPlanId: "$creditBasedPlan.planId" },
                    pipeline: [
                        {
                            $addFields: {
                                _id: { $toString: "$_id" }
                            }
                        },
                        {
                            $match: {
                                $expr: { $eq: ["$_id", "$$creditBasedPlanId"] }
                            }
                        }
                    ],
                    as: "creditBasedPlanDetails"
                }
            },
            {
                $lookup: {
                    from: "organization-plans",
                    let: { premiumPlanId: "$premiumPlan.planId" },
                    pipeline: [
                        {
                            $addFields: {
                                _id: { $toString: "$_id" }
                            }
                        },
                        {
                            $match: {
                                $expr: { $eq: ["$_id", "$$premiumPlanId"] }
                            }
                        }
                    ],
                    as: "premiumPlanDetails"
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    image: 1,
                    status: 1,
                    updatedAt: 1,
                    activeJobs: { $size: "$careers" },
                    members: { $size: "$members" },
                    nameLower: {
                        $toLower: "$name"
                    },
                    creditBasedJobSlotAdjustment: "$creditBasedPlan.jobSlotAdjustment",
                    premiumJobSlotAdjustment: "$premiumPlan.jobSlotAdjustment",
                    creditBasedPlan: 1,
                    premiumPlan: 1,
                    creditBasedPlanDetails: 1,
                    premiumPlanDetails: 1,
                }
            },
            {
                $sort: defaultSort,
            }
        ]).toArray();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const formattedOrganizations = organizations.map((organization: any) => {
            const seenPlanIds = new Set<string>();

            // Check if plans are expired
            const creditBasedEndDate = organization.creditBasedPlan?.endDate ? new Date(organization.creditBasedPlan.endDate) : null;
            const premiumEndDate = organization.premiumPlan?.endDate ? new Date(organization.premiumPlan.endDate) : null;

            const isCreditBasedExpired = creditBasedEndDate ? creditBasedEndDate < todayStart : false;
            const isPremiumExpired = premiumEndDate ? premiumEndDate < todayStart : false;

            const plans = [
                ...(organization.creditBasedPlanDetails || []),
                ...(organization.premiumPlanDetails || [])
            ].filter((plan: any) => {
                if (!plan) return false;
                const planId = plan._id?.toString();

                // Exclude if already seen
                if (planId && seenPlanIds.has(planId)) {
                    return false;
                }

                // Exclude if this specific plan type is expired
                const isPlanTypeExpired = plan.schema === 'credit-based' ? isCreditBasedExpired : isPremiumExpired;
                if (isPlanTypeExpired) {
                    return false;
                }

                if (planId) {
                    seenPlanIds.add(planId);
                }
                return true;
            });

            // Calculate effective job limits including per-org adjustments (only if not expired)
            const creditBasedBaseLimit = (!isCreditBasedExpired && organization.creditBasedPlanDetails?.[0]) ? organization.creditBasedPlanDetails[0].maxActiveJobPosts : 0;
            const creditBasedAdjustment = !isCreditBasedExpired ? (organization.creditBasedJobSlotAdjustment || 0) : 0;
            const effectiveCreditBasedLimit = (creditBasedBaseLimit === null) ? null : creditBasedBaseLimit + creditBasedAdjustment;

            const premiumBaseLimit = (!isPremiumExpired && organization.premiumPlanDetails?.[0]) ? organization.premiumPlanDetails[0].maxActiveJobPosts : 0;
            const premiumAdjustment = !isPremiumExpired ? (organization.premiumJobSlotAdjustment || 0) : 0;
            const effectivePremiumLimit = (premiumBaseLimit === null) ? null : premiumBaseLimit + premiumAdjustment;

            // Sum both plan limits - if either is null (unlimited), total is null
            const totalJobLimit = (effectiveCreditBasedLimit === null || effectivePremiumLimit === null) ? null : effectiveCreditBasedLimit + effectivePremiumLimit;
            // Sum adjustments for display breakdown
            const totalAdjustment = creditBasedAdjustment + premiumAdjustment;
            // Total base limit - if either base limit is null, total base is null
            const totalBaseLimit = (creditBasedBaseLimit === null || premiumBaseLimit === null) ? null : ((isCreditBasedExpired ? 0 : creditBasedBaseLimit) + (isPremiumExpired ? 0 : premiumBaseLimit));

            return {
                ...organization,
                plans,
                jobLimit: totalJobLimit,
                totalBaseLimit,
                totalAdjustment,
                isCreditBasedExpired,
                isPremiumExpired
            }
        });
        return NextResponse.json(formattedOrganizations);
    } catch (error) {
        console.error("Error fetching organizations:", error);
        return NextResponse.json({ error: "Error fetching organizations" }, { status: 500 });
    }
});