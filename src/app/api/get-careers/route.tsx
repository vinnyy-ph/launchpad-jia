import { NextResponse } from "next/server";
import connectMongoDB from "../../../lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { ObjectId } from "mongodb";
import { fetchBadgeDataForCareers, attachBadgesToCareers, getCareerViewStatusMap } from "@/lib/utils/badgeComputations";
import { EXCLUDE_ARCHIVED, archivedConstraint } from "@/lib/utils/careerArchive";


export const GET = withAuth(async (request: AuthenticatedRequest) => {
    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const userEmail = request.user.email;
    const search = searchParams.get("search");
    const sortConfig = searchParams.get("sortConfig");
    const status = searchParams.get("status");
    const projectId = searchParams.get("projectId");
    const includeBadges = searchParams.get("includeBadges") === "true";
    const activityStatus = searchParams.get("activityStatus");
    const jobPostType = searchParams.get("jobPostType");
    const jobOwners = searchParams.get("jobOwners");
    const projectIds = searchParams.get("projectIds");
    const contributors = searchParams.get("contributors");
    const hiringManagers = searchParams.get("hiringManagers");

    try {
        const { db } = await connectMongoDB();

        // Filter careers based on projectId if provided
        let projectCareerIds: string[] | null = null;
        const projectIdsArray = [];
        if (projectId) {
            projectIdsArray.push(projectId);
        }
        if (projectIds) {
            projectIdsArray.push(...projectIds.split(","));
        }
        if (projectIdsArray.length > 0) {
            const projects = await db.collection("projects").find({
                _id: { $in: projectIdsArray.map(id => new ObjectId(id)) },
                orgID,
            }).project({ _id: 1, careers: 1 }).toArray();

            if (projects.length > 0) {
                projectCareerIds = projects.flatMap(project => project.careers || []);
            } else {
                // Project not found, return empty results
                return NextResponse.json({
                    careers: [],
                    totalCareers: 0,
                    totalPages: 0,
                    currentPage: page,
                    totalActiveCareers: 0,
                });
            }
        }

        const authUserRole = await db.collection("members").findOne({ email: userEmail, orgID });
        const adminAccount = await db.collection("admins").findOne({ email: userEmail });

        if (!authUserRole && !adminAccount) {
            return NextResponse.json({ error: "You are not authorized to access this organization's careers" }, { status: 403 });
        }
        // Filter careers based on the user's role
        let filter: any = { orgID };
        if (authUserRole?.role === "hiring_manager" && authUserRole?.careers?.length > 0) {
            filter.id = { $in: authUserRole?.careers };
        }

        // Add project filter if projectId was provided
        if (projectCareerIds !== null) {
            if (filter.id) {
                // Get the careers to find their id values
                const projectCareers = await db.collection("careers").find({
                    _id: { $in: projectCareerIds.map(id => new ObjectId(id)) },
                    orgID
                }).project({ id: 1 }).toArray();

                // Convert projectCareerIds (_id strings) to id field values
                const projectCareerIdValues = projectCareers.map(c => c.id);
                filter.id = {
                    $in: filter.id.$in.filter((id: string) => projectCareerIdValues.includes(id))
                };
            } else {
                filter._id = { $in: projectCareerIds.map(id => new ObjectId(id)) };
            }
        }

        if (search) {
            // Escape special regex characters to treat search as literal string
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.jobTitle = { $regex: escapedSearch, $options: "i" };
        }

        let defaultSort: any = { status: 1, lastActivityAt: -1, _id: -1 };

        if (sortConfig) {
            const config = JSON.parse(sortConfig);
            const key = config.key;
            defaultSort = { [key]: config.direction === "ascending" ? 1 : -1, _id: -1 };
        }

        const tokens = status && status !== "All Statuses" ? status.split(",") : [];
        // CAREER_STATUS_OPTIONS sends lowercase "archived"; tolerate the capitalized form too.
        const normalizedTokens = tokens.map((s) => (s === "Archived" ? "archived" : s));
        // "Archived" is an exclusive view toggle (see archivedConstraint): when selected,
        // show ONLY archived careers and ignore the other status tokens; otherwise hide
        // archived by default and apply the remaining status tokens as usual.
        Object.assign(filter, archivedConstraint(normalizedTokens));
        if (!normalizedTokens.includes("archived") && normalizedTokens.length) {
            filter.status = { $in: normalizedTokens.map((s) =>
                s === "Published" ? "active" : s === "Unpublished" ? "inactive" : s
            ) };
        }

        if (activityStatus) {
            filter.activityStatus = { $in: activityStatus.split(",") };
        }

        if (jobPostType) {
            filter.jobPostType = { $in: jobPostType.split(",") };
        }

        if (jobOwners || contributors || hiringManagers) {
            filter.$and = [
                ...(jobOwners ? [{
                    $or: [
                        { teamMembers: { $elemMatch: { email: { $in: jobOwners.split(",") }, role: "Job Owner"  } } },
                        { "createdBy.email": { $in: jobOwners.split(",") } },
                    ]
                }] : []),
                ...(contributors ? [{
                    teamMembers: { $elemMatch: { email: { $in: contributors.split(",") }, role: "Contributor" } }
                }] : []),
                ...(hiringManagers ? [{
                    teamMembers: { $elemMatch: { email: { $in: hiringManagers.split(",") }, role: "Hiring Manager" } }
                }] : []),
            ]
        }

        // For Recent Activity sort with badges, we need to compute badges BEFORE pagination
        // Otherwise careers with new comments on page 2+ won't bubble up to page 1
        const shouldComputeBadgesFirst = includeBadges && !sortConfig;

        let allCareers: any[] = [];
        let careers: any[] = [];

        const interviewCountLookup = {
            $lookup: {
                from: "interviews",
                let: { careerId: "$id" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$id", "$$careerId"] } } },
                    {
                        $group: {
                            _id: "$id",
                            interviewsInProgress: {
                                $sum: {
                                    $cond: {
                                        if: {
                                            $and: [
                                                {
                                                    $or: [
                                                        { $eq: ["$applicationStatus", "Ongoing"] },
                                                        { $eq: ["$applicationStatus", null] },
                                                        { $eq: [{ $type: "$applicationStatus" }, "missing"] },
                                                    ],
                                                },
                                                {
                                                    $and: [
                                                        { $ne: ["$createdAt", null] },
                                                        { $ne: [{ $type: "$createdAt" }, "missing"] },
                                                    ],
                                                },
                                            ],
                                        },
                                        then: 1,
                                        else: 0,
                                    },
                                },
                            },
                            dropped: {
                                $sum: {
                                    $cond: {
                                        if: {
                                            $or: [
                                                { $eq: ["$applicationStatus", "Dropped"] },
                                                { $eq: ["$applicationStatus", "Cancelled"] },
                                            ],
                                        },
                                        then: 1,
                                        else: 0,
                                    },
                                },
                            },
                            hired: {
                                $sum: {
                                    $cond: {
                                        if: { $eq: ["$applicationStatus", "Hired"] },
                                        then: 1,
                                        else: 0,
                                    },
                                },
                            },
                        },
                    },
                ],
                as: "interviewCounts",
            },
        };

        const mergeInterviewCounts = [
            { $set: { interviewCounts: { $arrayElemAt: ["$interviewCounts", 0] } } },
            {
                $set: {
                    interviewsInProgress: { $ifNull: ["$interviewCounts.interviewsInProgress", 0] },
                    dropped: { $ifNull: ["$interviewCounts.dropped", 0] },
                    hired: { $ifNull: ["$interviewCounts.hired", 0] },
                },
            },
            { $unset: "interviewCounts" },
        ];

        const projectLookup = [
            {
                $lookup: {
                    from: "projects",
                    let: { careerId: { $toString: "$_id" } },
                    pipeline: [
                        { 
                            $match: {
                                $expr: {
                                    $in: ["$$careerId", "$careers"]
                                }
                            }
                        },
                        { $project: { _id: 1, name: 1 } },
                    ],
                    as: "project",
                },
            },
            {
                $addFields: {
                    projectName: { $ifNull: [{$arrayElemAt: ["$project.name", 0]}, null] },
                }
            }
        ];

        const parentCareerLookup = [
            {
                $lookup: {
                    from: "careers",
                    let: { parentId: "$parentCareerID" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$id", "$$parentId"] },
                                        { $ne: ["$$parentId", null] },
                                    ],
                                },
                            },
                        },
                        { $project: { _id: 0, jobTitle: 1 } },
                    ],
                    as: "_parentCareer",
                },
            },
            {
                $addFields: {
                    parentCareerTitle: { $ifNull: [{ $arrayElemAt: ["$_parentCareer.jobTitle", 0] }, null] },
                },
            },
            { $unset: "_parentCareer" },
        ];

        const requisitionLookup = [
            {
                $lookup: {
                    from: "requisitions",
                    let: { careerId: "$id" },
                    pipeline: [
                        { 
                            $match: { 
                                $expr: {
                                    $and: [
                                        {
                                            $or: [
                                                { $eq: ["$careerID", "$$careerId"] },
                                                { $eq: ["$careerId", "$$careerId"] },
                                                { $eq: ["$id", "$$careerId"] },
                                            ]
                                        },
                                        { $ne: ["$status", "pending"] },
                                    ]
                                } 
                            } 
                        },

                    ],
                    as: "requisitions",
                }
            }
        ];

        if (shouldComputeBadgesFirst) {
            // Step 1: Fetch ALL careers (without pagination) to compute badges
            allCareers = await db
                .collection("careers")
                .aggregate([
                    { $match: filter },
                    ...requisitionLookup,
                    ...projectLookup,
                    ...parentCareerLookup,
                    { $project: { questions: 0 } },
                ])
                .toArray();

            // Step 2: Compute badges for ALL careers
            if (allCareers.length > 0) {
                const userId = request.user.uid;
                const userEmail = request.user.email;
                const careerIds = allCareers.map((c: any) => c.id);
                const viewStatusMap = getCareerViewStatusMap(allCareers, userEmail, { onlyRecentCareers: true, daysThreshold: 3 });

                const rankedInterviews = await db.collection("interviews").aggregate([
                    { $match: { orgID, id: { $in: careerIds } }},
                    {
                        $lookup: {
                            from: "comments",
                            let: { interviewID: "$interviewID" },
                            pipeline: [
                                { $match: { $expr: { 
                                    $and: [
                                        { $eq: ["$interviewID", "$$interviewID"] },
                                        { $ne: ["$deleted", true] },
                                        // Not viewed by current user
                                        { $not: { $in: [userEmail, { $ifNull: ["$viewedBy", []] }] } },
                                    ]
                                } } },
                                { $project: { _id: 1, viewedBy: 1, deleted: 1 } },
                            ],
                            as: "comments",
                        }
                    },
                    // Group by id to get comment count, urgent action count, hired, ongoing, dropped
                    {
                        $group: {
                            _id: "$id",
                            newCommentsArray: {
                                $addToSet: {
                                    // For each comment attach interview application status
                                    $map: {
                                        input: "$comments",
                                        as: "comment",
                                        in: {
                                            $mergeObjects: [
                                                "$$comment",
                                                { applicationStatus: "$applicationStatus" }
                                            ]
                                        }
                                    }
                                }
                            },
                            urgentAction: {
                                $sum: {
                                    $cond: {
                                        if: {
                                            $or: [
                                                { $eq: ["$currentStep", "Needs Review"] },
                                                { $eq: ["$currentStep", "Pending"] },
                                                { $eq: ["$currentStep", "Awaiting Decision"] },
                                                { $eq: ["$status", "Needs Review"] },
                                                { $eq: ["$status", "Pending"] },
                                                { $eq: ["$status", "Awaiting Decision"] },
                                            ],
                                        },
                                        then: 1,
                                        else: 0,
                                    },
                                },
                            },
                            interviewsInProgress: {
                                $sum: {
                                    $cond: {
                                        if: {
                                            $and: [
                                                {
                                                    $or: [
                                                        { $eq: ["$applicationStatus", "Ongoing"] },
                                                        { $eq: ["$applicationStatus", null] },
                                                        { $eq: [{ $type: "$applicationStatus" }, "missing"] },
                                                    ],
                                                },
                                                {
                                                    $and: [
                                                        { $ne: ["$createdAt", null] },
                                                        { $ne: [{ $type: "$createdAt" }, "missing"] },
                                                    ],
                                                },
                                            ],
                                        },
                                        then: 1,
                                        else: 0,
                                    },
                                },
                            },
                            dropped: {
                                $sum: {
                                    $cond: {
                                        if: {
                                            $or: [
                                                { $eq: ["$applicationStatus", "Dropped"] },
                                                { $eq: ["$applicationStatus", "Cancelled"] },
                                            ],
                                        },
                                        then: 1,
                                        else: 0,
                                    },
                                },
                            },
                            hired: {
                                $sum: {
                                    $cond: {
                                        if: { $eq: ["$applicationStatus", "Hired"] },
                                        then: 1,
                                        else: 0,
                                    },
                                },
                            },
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            newComments: {
                                // reduce and flatten array of comments
                                $filter: {
                                    input: {
                                        $reduce: {
                                            input: "$newCommentsArray",
                                            initialValue: [],
                                            in: {
                                                $concatArrays: ["$$value", "$$this"]
                                            }
                                        }
                                    },
                                    as: "comment",
                                    cond: {
                                        $and: [
                                            { $ne: ["$$comment.applicationStatus", "Dropped"] },
                                            { $ne: ["$$comment.applicationStatus", "Cancelled"] },
                                            { $ne: [{ $type: "$$comment._id" }, "missing"] },
                                        ]
                                    }
                                }
                                
                            },
                            urgentAction: 1,
                            interviewsInProgress: 1,
                            dropped: 1,
                            hired: 1,
                        }
                    }
                ]).toArray();
                for (const career of allCareers) {
                    const interview = rankedInterviews.find((i: any) => i._id === career.id);
                    if (interview) {
                        career.interviewsInProgress = interview.interviewsInProgress;
                        career.dropped = interview.dropped;
                        career.hired = interview.hired;
                        career.badges = {
                            newComments: interview.newComments?.length || 0,
                            importantActions: interview.urgentAction + (career.requisitions?.length || 0),
                            isNew: viewStatusMap.get(career.id) || false,
                        }
                    } else {
                        career.badges = {
                            newComments: 0,
                            importantActions: 0,
                            isNew: viewStatusMap.get(career.id) || false,
                        }
                    }
                }

                // Step 3: Sort by badges/comments first
                allCareers.sort((a: any, b: any) => {
                    const aHasBadges = (a.badges?.newComments > 0) || (a.badges?.importantActions > 0) || a.badges?.isNew;
                    const bHasBadges = (b.badges?.newComments > 0) || (b.badges?.importantActions > 0) || b.badges?.isNew;

                    if (aHasBadges !== bHasBadges) {
                        return aHasBadges ? -1 : 1;
                    }

                    if (a.status !== b.status) {
                        return a.status === 'active' ? -1 : 1;
                    }

                    const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
                    const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;

                    if (aTime !== bTime) {
                        return bTime - aTime;
                    }

                    return b._id.toString().localeCompare(a._id.toString());
                });
            }

            // Step 4: Apply pagination AFTER sorting
            const startIndex = (page - 1) * limit;
            careers = allCareers.slice(startIndex, startIndex + limit);
        } else {
            // Standard flow: MongoDB sort + pagination, then compute badges
            careers = await db
                .collection("careers")
                .aggregate([
                    { $match: filter },
                    interviewCountLookup,
                    ...mergeInterviewCounts,
                    ...projectLookup,
                    ...parentCareerLookup,
                    { $sort: defaultSort },
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                    {
                        $project: {
                            questions: 0,
                        }
                    },
                ]).toArray();

            // Compute badges after pagination for non-Recent Activity sorts
            if (includeBadges && careers.length > 0) {
                const userId = request.user.uid;
                const userEmail = request.user.email;
                const careerIds = careers.map((c: any) => c.id);

                const badgeDataMaps = await fetchBadgeDataForCareers(db, careerIds, userId, orgID as string, userEmail);

                attachBadgesToCareers(careers, badgeDataMaps, userEmail);
            }
        }

        const total = shouldComputeBadgesFirst ? allCareers.length : await db.collection("careers").countDocuments(filter);
        const totalPages = Math.ceil(total / limit);
        const totalActiveCareers = await db.collection("careers").countDocuments({ orgID, status: "active", ...EXCLUDE_ARCHIVED });

        return NextResponse.json({
            careers,
            totalCareers: total,
            totalPages,
            currentPage: page,
            totalActiveCareers,
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch careers" }, { status: 500 });
    }
});