import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import connectMongoDB from "../../../lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import moment from "moment";
import { DEFAULT_JOB_PIPELINE } from "../../../lib/utils/constants";
import { ObjectId } from "mongodb";
import { EXCLUDE_ARCHIVED, withExcludeArchived } from "@/lib/utils/careerArchive";

interface DateFilter {
    type: "Custom" | "Today" | "7D" | "30D" | "3M" | "6M" | "12M" | "All-time" | "Default";
    startDate?: Date;
    endDate?: Date;
}

export const GET = withAuth(async (request: AuthenticatedRequest) => {

    try {
        const { db } = await connectMongoDB();
        const { searchParams } = new URL(request.url);
        const orgID = searchParams.get("orgID");
        if (!orgID) {
            return NextResponse.json({ error: "Org ID is required" }, { status: 400 });
        }
        const timeFilter = searchParams.get("timeFilter") || "Default";
        const startDate = searchParams.get("startDate") || null;
        const endDate = searchParams.get("endDate") || null;
        const dateFilter: DateFilter = {
            type: timeFilter as DateFilter["type"],
            startDate: startDate ? moment(startDate).startOf('day').toDate() : null,
            endDate: endDate ? moment(endDate).endOf('day').toDate() : null,
        }
        let careerFilter = searchParams.get("careerFilter")?.split(",")?.filter((c) => c !== "") || [];
        const metricType = searchParams.get("metricType") || "All";
        const jobOwnerFilter = searchParams.get("jobOwnerFilter")?.split(",")?.filter((j) => j !== "") || [];
        const projectFilter = searchParams.get("projectFilter")?.split(",")?.filter((p) => p !== "") || [];
        const contributorFilter = searchParams.get("contributorFilter")?.split(",")?.filter((c) => c !== "") || [];
        const hiringManagerFilter = searchParams.get("hiringManagerFilter")?.split(",")?.filter((h) => h !== "") || [];
        const userEmail = request.user.email;

        const authUserRole = await db.collection("members").findOne({ email: userEmail, orgID });
        const adminAccount = await db.collection("admins").findOne({ email: userEmail });
        if (!authUserRole && !adminAccount) {
            return NextResponse.json({ error: "You are not authorized to access this organization's analytics" }, { status: 403 });
        }

        const hasFullAccess = authUserRole?.role === "admin" || authUserRole?.role === "recruiter" || !!adminAccount;
        let careerIds: string[] = careerFilter;

        // Archived careers stay out of analytics (T4). The careers-collection reads
        // below are gated via withExcludeArchived, but the interviews-collection
        // aggregations can only exclude by career id — resolve the org's archived
        // ids once so every unfiltered interview match can $nin them.
        const archivedCareers = await db.collection("careers")
            .find({ orgID, archived: true })
            .project({ _id: 1, id: 1 })
            .toArray();
        const archivedCareerIds: string[] = archivedCareers.map((c: any) => c.id).filter(Boolean);
        const archivedCareerMongoIds: string[] = archivedCareers.map((c: any) => c._id?.toString()).filter(Boolean);
        
        if (!hasFullAccess) {
            const assignedCareers = await db.collection("careers").find(withExcludeArchived({
                orgID: orgID,
                "teamMembers.email": userEmail,
            })).project({ _id: 1, id: 1 }).toArray();
            const assignedCareerIds = assignedCareers.map((c: any) => c.id);
            // The member doc's raw career list is never archive-filtered — drop
            // archived ids so a member whose careers are all archived gets the
            // "No careers assigned" response instead of unscoped analytics.
            const allowedCareerIds = [...new Set([...(authUserRole?.careers || []), ...assignedCareerIds])]
                .filter((id) => !archivedCareerIds.includes(id));

            if (careerIds.length > 0) {
                careerIds = careerIds.filter((id) => allowedCareerIds.includes(id));
            }
            careerIds = careerIds.length > 0 ? careerIds : allowedCareerIds;

            if (careerIds.length === 0) {
                return NextResponse.json({
                    success: false,
                    message: "No careers assigned to this account",
                });
            }
        }

        let projectCareerIds: ObjectId[] = [];
        if (projectFilter?.length > 0) {
            const projects = await db.collection("projects").find({
                _id: { $in: projectFilter.map(id => new ObjectId(id)) },
                orgID,
            }).project({ _id: 1, careers: 1 }).toArray();
            projectCareerIds = projects.flatMap(project => project.careers.map(c => new ObjectId(c)) || []);

            const careers = await db.collection("careers").find(withExcludeArchived({
                orgID: orgID,
                _id: { $in: projectCareerIds },
            })).project({ _id: 1, id: 1 }).toArray();
            const careerIdsArray = careers.map((c: any) => c.id);
            
            if (careerIds.length > 0) {
                careerIds = careerIds.filter((id) => careerIdsArray.includes(id));
            } else {
                careerIds = careerIdsArray;
            }

            if (careerIds.length === 0) {
                return NextResponse.json({
                    success: false,
                    message: "No careers found in the project",
                });
            }
        }

        const memberFilters: {email: string, role: string}[] = [];
        if (jobOwnerFilter.length > 0) {
            memberFilters.push(...jobOwnerFilter.map((j) => ({ email: j, role: "Job Owner" })));
        }
        if (contributorFilter.length > 0) {
            memberFilters.push(...contributorFilter.map((c) => ({ email: c, role: "Contributor" })));
        }

        if (hiringManagerFilter.length > 0) {
            memberFilters.push(...hiringManagerFilter.map((h) => ({ email: h, role: "Hiring Manager" })));
        }

        const activeCareersData = await getActiveCareers(db, orgID, careerIds, dateFilter, memberFilters, archivedCareerMongoIds);
        const hasCareerFilters = careerFilter.length > 0 || projectFilter.length > 0 || jobOwnerFilter.length > 0 || contributorFilter.length > 0 || hiringManagerFilter.length > 0;

        if (hasCareerFilters && activeCareersData.selectedCareers.length === 0) {
            return NextResponse.json({
                success: false,
                message: "No careers found with the selected filters",
            });
        }
        if (metricType === "active-careers") {
            return NextResponse.json({
                metricValue: activeCareersData.currentValue,
                pastValue: activeCareersData.pastValue,
                percentageChange: activeCareersData.percentageChange,
                comparedTo: activeCareersData.comparedTo,
                data: activeCareersData.data,
            });
        } else if (metricType === "new-applicants") {
            const newApplicantsData = await getNewApplicants(db, orgID, hasCareerFilters ? activeCareersData.selectedCareers.map((c) => c.id) : [], dateFilter, archivedCareerIds);
            return NextResponse.json({
                metricValue: newApplicantsData.currentValue,
                pastValue: newApplicantsData.pastValue,
                percentageChange: newApplicantsData.percentageChange,
                comparedTo: newApplicantsData.comparedTo,
                data: newApplicantsData.data,
            })
        } else if (metricType === "hires") {
            const hires = await getHires(db, orgID, hasCareerFilters ? activeCareersData.selectedCareers.map((c) => c.id) : [], dateFilter, archivedCareerIds);
            return NextResponse.json({
                metricValue: hires.currentValue,
                pastValue: hires.pastValue,
                percentageChange: hires.percentageChange,
                comparedTo: hires.comparedTo,
                data: hires.data,
            });
        } else if (metricType === "application-volume") {
            const applicationVolume = await getApplicationVolume(db, orgID, hasCareerFilters ? activeCareersData.selectedCareers.map((c) => c.id) : [], dateFilter, archivedCareerIds);
            return NextResponse.json({
                applicationVolume: applicationVolume
            })
        } else if (metricType === "time-to-hire") {
            const timeToHire = await getTimeToHire(db, orgID, activeCareersData.selectedCareers.map((c) => c._id), dateFilter);
            return NextResponse.json({
                timeToHire: timeToHire,
            });
        } else if (metricType === "drop-off-rate") {
            const dropOffData = await getDropOffRate(db, orgID, hasCareerFilters ? activeCareersData.selectedCareers.map((c) => c.id) : [], dateFilter);
            return NextResponse.json({
                dropOffRate: dropOffData
            });
        } else if (metricType === "stage-aging") {
            const stageAging = await getStageAging(db, orgID, hasCareerFilters ? activeCareersData.selectedCareers.map((c) => c._id.toString()) : [], dateFilter);
            return NextResponse.json({
                stageAging: {
                    careers: stageAging
                },
            });
        } else if (metricType === "offer-acceptance-rate") {
            const offerAcceptanceRate = await getOfferAcceptanceRate(db, orgID, activeCareersData.selectedCareers.map((c) => c._id), dateFilter);
            return NextResponse.json({
                offerAcceptanceRate: offerAcceptanceRate,
            });
        } else if (metricType === "endorsement-efficiency") {
            const endorsementEfficiency = await getEndorsementEfficiency(db, orgID, activeCareersData.selectedCareers.map((c) => c._id), dateFilter);
            return NextResponse.json({
                endorsementEfficiency: endorsementEfficiency,
            });
        } else if (metricType === "stage-pass-rate") {
            const stagePassRate = await getStagePassRate(db, orgID, hasCareerFilters ? activeCareersData.selectedCareers.map((c) => c.id) : [], dateFilter);
            return NextResponse.json({
                stagePassRate: stagePassRate,
            });
        }


        const [newApplicantsData, hireData, applicationVolume, dropOffData, stageAging, offerAcceptanceRate, endorsementEfficiency, timeToHire, stagePassRateData] = await Promise.all([
            getNewApplicants(db, orgID, hasCareerFilters ? activeCareersData.selectedCareers.map((c) => c.id) : [], dateFilter, archivedCareerIds),
            getHires(db, orgID, hasCareerFilters ? activeCareersData.selectedCareers.map((c) => c.id) : [], dateFilter, archivedCareerIds),
            getApplicationVolume(db, orgID, hasCareerFilters ? activeCareersData.selectedCareers.map((c) => c.id) : [], dateFilter, archivedCareerIds),
            getDropOffRate(db, orgID, hasCareerFilters ? activeCareersData.selectedCareers.map((c) => c.id) : [], dateFilter),
            getStageAging(db, orgID, hasCareerFilters ? activeCareersData.selectedCareers.map((c) => c._id.toString()) : [], dateFilter),
            getOfferAcceptanceRate(db, orgID, activeCareersData.selectedCareers.map((c) => c._id), dateFilter),
            getEndorsementEfficiency(db, orgID, activeCareersData.selectedCareers.map((c) => c._id), dateFilter),
            getTimeToHire(db, orgID, activeCareersData.selectedCareers.map((c) => c._id), dateFilter),
            getStagePassRate(db, orgID, hasCareerFilters ? activeCareersData.selectedCareers.map((c) => c.id) : [], dateFilter),
        ]);
        return NextResponse.json({
            activeCareers: {
                metricValue: activeCareersData.currentValue,
                pastValue: activeCareersData.pastValue,
                percentageChange: activeCareersData.percentageChange,
                comparedTo: activeCareersData.comparedTo,
                data: activeCareersData.data,
            },
            newApplicants: {
                metricValue: newApplicantsData.currentValue,
                pastValue: newApplicantsData.pastValue,
                percentageChange: newApplicantsData.percentageChange,
                comparedTo: newApplicantsData.comparedTo,
                data: newApplicantsData.data,
            },
            hires: {
                metricValue: hireData.currentValue,
                pastValue: hireData.pastValue,
                percentageChange: hireData.percentageChange,
                comparedTo: hireData.comparedTo,
                data: hireData.data,
            },
            applicationVolume: applicationVolume,
            timeToHire: timeToHire,
            dropOffRate: dropOffData,
            stageAging: {
                careers: stageAging
            },
            offerAcceptanceRate: {
                data: offerAcceptanceRate
            },
            endorsementEfficiency: {
                data: endorsementEfficiency
            },
            stagePassRate: stagePassRateData,
        });
    } catch (error) {
        console.error("Error fetching analytics:", error);
        return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
    }
});

const getActiveCareers = async (db: any, orgID: string, careerIds: string[], dateFilter: DateFilter, memberFilters: {email: string, role: string}[], archivedCareerMongoIds: string[] = []) => {
    let matchTime = {};
    let timeRangeStart;
    let timeRangeEnd;
    let comparedTo = "";

    switch (dateFilter.type) {
        case "Today":
            timeRangeStart = moment().startOf("day").toDate();
            timeRangeEnd = moment().subtract(1, "day").startOf("day").toDate();
            matchTime = {
                createdAt: { $gte: timeRangeEnd, $lt: timeRangeStart },
            }
            comparedTo = "yesterday";
            break;
        case "7D":
            timeRangeStart = moment().subtract(7, "days").startOf("day").toDate();
            timeRangeEnd = moment(timeRangeStart).subtract(7, "days").startOf("day").toDate();
            matchTime = {
                $or: [
                    { createdAt: { $gte: timeRangeStart } },
                    { createdAt: { $gte: timeRangeEnd, $lt: timeRangeStart } }
                ]
            }
            comparedTo = "the last 7 days";
            break;
        case "30D":
            timeRangeStart = moment().subtract(30, "days").startOf("day").toDate();
            timeRangeEnd = moment(timeRangeStart).subtract(30, "days").startOf("day").toDate();
            matchTime = {
                $or: [
                    { createdAt: { $gte: timeRangeStart } },
                    { createdAt: { $gte: timeRangeEnd, $lt: timeRangeStart } }
                ]
            }
            comparedTo = "the last 30 days";
            break;
        case "3M":
            timeRangeStart = moment().subtract(3, "months").startOf("day").toDate();
            timeRangeEnd = moment(timeRangeStart).subtract(3, "months").startOf("day").toDate();
            matchTime = {
                $or: [
                    { createdAt: { $gte: timeRangeStart } },
                    { createdAt: { $gte: timeRangeEnd, $lt: timeRangeStart } }
                ]
            }
            comparedTo = "the last 3 months";
            break;
        case "6M":
            timeRangeStart = moment().subtract(6, "months").startOf("day").toDate();
            timeRangeEnd = moment(timeRangeStart).subtract(6, "months").startOf("day").toDate();
            matchTime = {
                $or: [
                    { createdAt: { $gte: timeRangeStart } },
                    { createdAt: { $gte: timeRangeEnd, $lt: timeRangeStart } }
                ]
            }
            comparedTo = "the last 6 months";
            break;
        case "12M":
            timeRangeStart = moment().subtract(12, "months").startOf("day").toDate();
            timeRangeEnd = moment(timeRangeStart).subtract(12, "months").startOf("day").toDate();
            matchTime = {
                $or: [
                    { createdAt: { $gte: timeRangeStart } },
                    { createdAt: { $gte: timeRangeEnd, $lt: timeRangeStart } }
                ]
            }
            comparedTo = "the last 12 months";
            break;
        case "All-time":
            break;
        case "Custom":
            timeRangeStart = dateFilter.startDate;
            // Check if same day
            const daysInSelectedRange = moment(dateFilter.endDate).isSame(moment(dateFilter.startDate), "day") ? 1 : moment(dateFilter.endDate).diff(moment(dateFilter.startDate), "days");
            timeRangeEnd = moment(timeRangeStart).subtract(daysInSelectedRange, "days").startOf("days").toDate();
            matchTime = {
                $or: [
                    // Selected Range
                    { createdAt: { $gte: timeRangeStart, $lt: dateFilter.endDate } },
                    // Compared to previous range
                    { createdAt: { $gte: timeRangeEnd, $lt: timeRangeStart } },
                ]
            }
            comparedTo = `${moment(timeRangeEnd).format("MMM D, YYYY")}` + (daysInSelectedRange === 1 ? "" : ` - ${moment(timeRangeStart).subtract(1, "day").format("MMM D, YYYY")}`);
            break;
        default:
            timeRangeEnd = moment().subtract(1, "month").startOf("month").toDate();
            timeRangeStart = moment().startOf("month").toDate();
            matchTime = {
                $or: [
                    // Current Month
                    { createdAt: { $gte: timeRangeStart } },
                    // Previous Month
                    { createdAt: { $gte: timeRangeEnd, $lt: timeRangeStart } }
                ]
            }
            comparedTo = "last month";
            break;
    }

    const jobOwnerFilters = memberFilters.filter((m) => m.role === "Job Owner");
    const contributorFilters = memberFilters.filter((m) => m.role === "Contributor");
    const hiringManagerFilters = memberFilters.filter((m) => m.role === "Hiring Manager");
    let memberMatch = {
        $and: [],
    };
    if (jobOwnerFilters.length > 0) {
        memberMatch.$and.push({
            $or: [
                { teamMembers: { $elemMatch: { email: { $in: jobOwnerFilters.map((m) => m.email) }, role: "Job Owner" } } },
                { createdBy: { $elemMatch: { email: { $in: jobOwnerFilters.map((m) => m.email) } } } },
            ]
        })
    }
    if (contributorFilters.length > 0) {
        memberMatch.$and.push({ teamMembers: { $elemMatch: { email: { $in: contributorFilters.map((m) => m.email) }, role: "Contributor" } } });
    }

    if (hiringManagerFilters.length > 0) {
        memberMatch.$and.push({ teamMembers: { $elemMatch: { email: { $in: hiringManagerFilters.map((m) => m.email) }, role: "Hiring Manager" } } });
    }

    const selectedCareers = await db.collection("careers").find(withExcludeArchived({
        orgID: orgID,
        ...(careerIds.length > 0 ? { id: { $in: careerIds } } : {}),
        ...(memberMatch.$and.length > 0 ? memberMatch : {}),
    })).toArray();
    const aggregatedData = await db.collection("recruiter-metrics").aggregate([
        {
            $match: {
                orgID: orgID,
                ...matchTime,
                isActiveCareer: true,
                // Filtered: history scoped to the (archive-gated) selected careers.
                // Unfiltered: exclude archived careers' historical rows so both
                // views share one exclusion semantic (review finding A3).
                ...(careerIds.length > 0
                    ? { careerId: { $in: selectedCareers.map((c) => c._id.toString()) } }
                    : archivedCareerMongoIds.length > 0
                        ? { careerId: { $nin: archivedCareerMongoIds } }
                        : {}),
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                activeCareers: { $sum: 1 },
            }
        },
        {
            $sort: {
                _id: 1
            }
        }
    ]).toArray();
    let pastValue = 0;
    let currentValue = 0;
    if (dateFilter.type === "All-time") {
        const total = aggregatedData.sort((a, b) => b.activeCareers - a.activeCareers)?.[0]?.activeCareers || 0;
        currentValue = total;
        pastValue = total;
    } else if (dateFilter.type === "Custom") {
        currentValue = moment(dateFilter.endDate).isSame(moment(dateFilter.startDate), "day") && moment(dateFilter.endDate).isSame(moment(), "day") ? selectedCareers?.filter((c) => c.status === "active").length : aggregatedData.filter((x) => moment(x._id).isSameOrAfter(dateFilter.startDate, "day")).sort((a, b) => b.activeCareers - a.activeCareers)?.[0]?.activeCareers || 0;
        pastValue = aggregatedData.filter((x) => moment(x._id).isSameOrAfter(timeRangeEnd, "day") && moment(x._id).isBefore(timeRangeStart, "day")).sort((a, b) => b.activeCareers - a.activeCareers)?.[0]?.activeCareers || 0;
    } else {
        currentValue = dateFilter.type === "Today" ? selectedCareers?.filter((c) => c.status === "active").length : aggregatedData.filter((x) => moment(x._id).isSameOrAfter(timeRangeStart, "day")).sort((a, b) => b.activeCareers - a.activeCareers)?.[0]?.activeCareers || 0;
        pastValue = aggregatedData.filter((x) => moment(x._id).isSameOrAfter(timeRangeEnd, "day") && moment(x._id).isBefore(timeRangeStart, "day")).sort((a, b) => b.activeCareers - a.activeCareers)?.[0]?.activeCareers || 0;
    }

    const formattedData = [];
    let lastValue = 0;
    for (const x of aggregatedData) {
        const percentageChange = computePercentChange(x.activeCareers, lastValue);
        lastValue = x.activeCareers;
        formattedData.push({
            date: x._id,
            value: x.activeCareers,
            percentageChange: percentageChange,
        });
    }
    return { 
        selectedCareers: selectedCareers,
        currentValue: currentValue,
        pastValue: pastValue,
        percentageChange: computePercentChange(currentValue, pastValue),
        comparedTo: comparedTo,
        data: formattedData,
    };
}

const getNewApplicants = async (db: any, orgID: string, careerIds: string[], dateFilter: DateFilter, archivedCareerIds: string[] = []) => {
    let matchTime = {};
    let grouping = {}
    let timeRangeStart;
    let timeRangeEnd;
    let comparedTo = "";

    switch (dateFilter.type) {
        case "Today":
            timeRangeStart = moment().startOf("day").toDate();
            timeRangeEnd = moment().subtract(1, "day").startOf("day").toDate();
            matchTime = {
                $or: [
                    // Today
                    { createdAt: { $gte: timeRangeStart } },
                    // Yesterday
                    { createdAt: { $gte: timeRangeEnd, $lt: timeRangeStart } }
                ] 
            };
            grouping = {
                $dateToString: { format: "%Y-%m-%d", date: "$interviews.createdAt" }
            };
            comparedTo = "yesterday";
            break;
        case "7D":
            timeRangeStart = moment().subtract(7, "days").startOf("day").toDate();
            timeRangeEnd = moment(timeRangeStart).subtract(7, "days").startOf("day").toDate()
            matchTime = { 
                $or: [
                    { createdAt: { $gte: timeRangeStart } },
                    // Last Month
                    { createdAt: { $gte: timeRangeEnd, $lt: timeRangeStart } }
                ]
            };
            grouping = {
                $dateToString: { format: "%Y-%m-%d", date: "$interviews.createdAt" }
            };
            comparedTo = "the last 7 days";
            break;
        case "30D":
            timeRangeStart = moment().subtract(30, "days").startOf("day").toDate();
            timeRangeEnd = moment(timeRangeStart).subtract(30, "days").startOf("day").toDate()
            matchTime = { 
                $or: [
                    { createdAt: { $gte: timeRangeStart } },
                    // Last Month
                    { createdAt: { $gte: timeRangeEnd, $lt: timeRangeStart } }
                ]
            };
            grouping = {
                $dateToString: { format: "%Y-%m-%d", date: "$interviews.createdAt" }
            };
            comparedTo = "the last 30 days";
            break;
        case "3M":
            timeRangeStart = moment().subtract(3, "months").startOf("day").toDate();
            timeRangeEnd = moment(timeRangeStart).subtract(3, "months").startOf("day").toDate()
            matchTime = {
                $or: [
                    { createdAt: { $gte: timeRangeStart } },
                    { createdAt: { $gte: timeRangeEnd, $lt: timeRangeStart } }
                ]
            };
            grouping = {
                $dateToString: { format: "%Y-%m-%d", date: "$interviews.createdAt" }
            };
            comparedTo = "the last 3 months";
            break;
        case "6M":
            timeRangeStart = moment().subtract(6, "months").startOf("day").toDate();
            timeRangeEnd = moment(timeRangeStart).subtract(6, "months").startOf("day").toDate()
            matchTime = {
                $or: [
                    { createdAt: { $gte: timeRangeStart } },
                    { createdAt: { $gte: timeRangeEnd, $lt: timeRangeStart } }
                ]
            };
            grouping = {
                $dateToString: { format: "%Y-%m-%d", date: "$interviews.createdAt" }
            };
            comparedTo = "the last 6 months";
            break;
        case "12M":
            timeRangeStart = moment().subtract(12, "months").startOf("day").toDate();
            timeRangeEnd = moment(timeRangeStart).subtract(12, "months").startOf("day").toDate()
            matchTime = {
                $or: [
                    { createdAt: { $gte: timeRangeStart } },
                    { createdAt: { $gte: timeRangeEnd, $lt: timeRangeStart } }
                ]
            };
            grouping = {
                $dateToString: { format: "%Y-%m-%d", date: "$interviews.createdAt" }
            };
            comparedTo = "the last 12 months";
            break;
        case "All-time":
            matchTime = {}
            break;
        case "Custom":
            timeRangeStart = dateFilter.startDate;
            const daysInSelectedRange = moment(dateFilter.endDate).isSame(moment(dateFilter.startDate), "day") ? 1 : moment(dateFilter.endDate).diff(moment(dateFilter.startDate), "days");
            timeRangeEnd = moment(timeRangeStart).subtract(daysInSelectedRange, "days").startOf("days").toDate();
            matchTime = {
                $or: [
                    // Selected Range
                    { createdAt: { $gte: timeRangeStart, $lt: dateFilter.endDate } },
                    // Compared to previous range
                    { createdAt: { $gte: timeRangeEnd, $lt: timeRangeStart } },
                ]
            }
            grouping = {
                $dateToString: { format: "%Y-%m-%d", date: "$interviews.createdAt" }
            };
            comparedTo = `${moment(timeRangeEnd).format("MMM D, YYYY")}` + (daysInSelectedRange === 1 ? "" : ` - ${moment(timeRangeStart).subtract(1, "day").format("MMM D, YYYY")}`);
            break;
        default:
            timeRangeEnd = moment().subtract(1, "month").startOf("month").toDate();
            timeRangeStart = moment().startOf("month").toDate();
            matchTime = {
                $or: [
                    { createdAt: { $gte: timeRangeStart } },
                    { createdAt: { $gte: timeRangeEnd, $lt: timeRangeStart } }
                ]
            }
            grouping = {
                $dateToString: { format: "%Y-%m-%d", date: "$interviews.createdAt" }
            };
            comparedTo = "last month";
            break;
    }
    const pipeline: any[] = [
        {
            $match: {
                orgID,
            }
        },
        {
            $lookup: {
                from: "interviews",
                let: {
                    email: "$applicantInfo.email",
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$email", "$$email"] },
                                    { $eq: ["$orgID", orgID] },
                                    ...(careerIds.length > 0 ? [{ $in: ["$id", careerIds] }] : []),
                                    // Unfiltered view: still keep archived careers' interviews out.
                                    ...(archivedCareerIds.length > 0 ? [{ $not: [{ $in: ["$id", archivedCareerIds] }] }] : []),
                                ],
                            },
                            ...matchTime,
                        },
                    }
                ],
                as: "interviews",
            },
        },
        {
            $unwind: {
                path: "$interviews",
                preserveNullAndEmptyArrays: false,
            },
        },
        {
            $group: {
                _id: grouping,
                newApplicants: { $sum: 1 },
            },
        },
        {
            $sort: {
                _id: 1
            }
        }
    ];
    const newApplicantsData = await db.collection("affiliations").aggregate(pipeline).toArray();

    let currentValue = 0;
    let pastValue = 0;
    
    if (dateFilter.type === "All-time") {
        const totalValue = newApplicantsData.reduce((acc, curr) => acc + curr.newApplicants, 0);
        currentValue = totalValue;
        pastValue = totalValue;
    } else if (dateFilter.type === "Custom") {
        currentValue = newApplicantsData.filter((x) => moment(x._id).isSameOrAfter(dateFilter.startDate, "day")).reduce((acc, curr) => acc + curr.newApplicants, 0);
        pastValue = newApplicantsData.filter((x) => moment(x._id).isSameOrAfter(timeRangeEnd, "day") && moment(x._id).isBefore(timeRangeStart, "day")).reduce((acc, curr) => acc + curr.newApplicants, 0);
    } else {
        currentValue = newApplicantsData.filter((x) => moment(x._id).isSameOrAfter(timeRangeStart, "day")).reduce((acc, curr) => acc + curr.newApplicants, 0);
        pastValue = newApplicantsData.filter((x) => moment(x._id).isSameOrAfter(timeRangeEnd, "day") && moment(x._id).isBefore(timeRangeStart, "day")).reduce((acc, curr) => acc + curr.newApplicants, 0);
    }

    const formattedData = [];
    let lastValue = 0;
    for (const x of newApplicantsData) {
        const percentageChange = computePercentChange(x.newApplicants, lastValue);
        lastValue = x.newApplicants;
        formattedData.push({
            date: x._id,
            value: x.newApplicants,
            percentageChange: percentageChange,
        });
    }
    return {
        currentValue: currentValue,
        pastValue: pastValue,
        percentageChange: computePercentChange(currentValue, pastValue),
        comparedTo: comparedTo,
        data: formattedData,
    };
}

const getHires = async (db: any, orgID: string, careerIds: string[], dateFilter: DateFilter, archivedCareerIds: string[] = []) => {
    let matchTime = {};
    let timeRangeStart: Date;
    let timeRangeEnd: Date;
    let comparedTo = "";
    switch (dateFilter.type) {
        case "Today":
            timeRangeStart = moment().startOf("day").toDate();
            timeRangeEnd = moment().subtract(1, "day").startOf("day").toDate();
            matchTime = {
                $or: [
                    { "applicationMetadata.updatedAt": { $gte: timeRangeStart.getTime() } },
                    { "applicationMetadata.updatedAt": { $gte: timeRangeEnd.getTime(), $lt: timeRangeStart.getTime() } }
                ]
            }
            comparedTo = "yesterday";
            break;
        case "7D":
            timeRangeStart = moment().subtract(7, "days").startOf("day").toDate();
            timeRangeEnd = moment(timeRangeStart).subtract(7, "days").startOf("day").toDate();
            matchTime = {
                $or: [
                    { "applicationMetadata.updatedAt": { $gte: timeRangeStart.getTime() } },
                    { "applicationMetadata.updatedAt": { $gte: timeRangeEnd.getTime(), $lt: timeRangeStart.getTime() } }
                ]
            }
            comparedTo = "the last 7 days";
            break;
        case "30D":
            timeRangeStart = moment().subtract(30, "days").startOf("day").toDate();
            timeRangeEnd = moment(timeRangeStart).subtract(30, "days").startOf("day").toDate();
            matchTime = {
                $or: [
                    { "applicationMetadata.updatedAt": { $gte: timeRangeStart.getTime() } },
                    { "applicationMetadata.updatedAt": { $gte: timeRangeEnd.getTime(), $lt: timeRangeStart.getTime() } }
                ]
            }
            comparedTo = "the last 30 days";
            break;
        case "3M":
            timeRangeStart = moment().subtract(3, "months").startOf("day").toDate();
            timeRangeEnd = moment(timeRangeStart).subtract(3, "months").startOf("day").toDate();
            matchTime = {
                $or: [
                    { "applicationMetadata.updatedAt": { $gte: timeRangeStart.getTime() } },
                    { "applicationMetadata.updatedAt": { $gte: timeRangeEnd.getTime(), $lt: timeRangeStart.getTime() } }
                ]
            }
            comparedTo = "the last 3 months";
            break;
        case "6M":
            timeRangeStart = moment().subtract(6, "months").startOf("day").toDate();
            timeRangeEnd = moment(timeRangeStart).subtract(6, "months").startOf("day").toDate();
            matchTime = {
                $or: [
                    { "applicationMetadata.updatedAt": { $gte: timeRangeStart.getTime() } },
                    { "applicationMetadata.updatedAt": { $gte: timeRangeEnd.getTime(), $lt: timeRangeStart.getTime() } }
                ]
            }
            comparedTo = "the last 6 months";
            break;
        case "12M":
            timeRangeStart = moment().subtract(12, "months").startOf("day").toDate();
            timeRangeEnd = moment(timeRangeStart).subtract(12, "months").startOf("day").toDate();
            matchTime = {
                $or: [
                    { "applicationMetadata.updatedAt": { $gte: timeRangeStart.getTime() } },
                    { "applicationMetadata.updatedAt": { $gte: timeRangeEnd.getTime(), $lt: timeRangeStart.getTime() } }
                ]
            }
            comparedTo = "the last 12 months";
            break;
        case "All-time":
            matchTime = {}
            break;
        case "Custom":
            timeRangeStart = dateFilter.startDate;
            const daysInSelectedRange = moment(dateFilter.endDate).isSame(moment(dateFilter.startDate), "day") ? 1 : moment(dateFilter.endDate).diff(moment(dateFilter.startDate), "days");
            timeRangeEnd = moment(timeRangeStart).subtract(daysInSelectedRange, "days").startOf("days").toDate();
            matchTime = {
                $or: [
                    // Selected Range
                    { "applicationMetadata.updatedAt": { $gte: timeRangeStart.getTime(), $lt: dateFilter.endDate.getTime() } },
                    // Compared to previous range
                    { "applicationMetadata.updatedAt": { $gte: timeRangeEnd.getTime(), $lt: timeRangeStart.getTime() } },
                ]
            }
            comparedTo = `${moment(timeRangeEnd).format("MMM D, YYYY")}` + (daysInSelectedRange === 1 ? "" : ` - ${moment(timeRangeStart).subtract(1, "day").format("MMM D, YYYY")}`);
            break;
        default:
            timeRangeEnd = moment().subtract(1, "month").startOf("month").toDate();
            timeRangeStart = moment().startOf("month").toDate();
            matchTime = {
                $or: [
                    { "applicationMetadata.updatedAt": { $gte: timeRangeStart.getTime() } },
                    { "applicationMetadata.updatedAt": { $gte: timeRangeEnd.getTime(), $lt: timeRangeStart.getTime() } }
                ]
            }
            comparedTo = "last month";
            break;
    }


    const hires = await db.collection("interviews").aggregate([
        {
            $match: {
                orgID: orgID,
                applicationStatus: "Hired",
                ...matchTime,
                // Filtered ids come from gated careers reads (already archive-free);
                // the unfiltered view excludes archived careers' interviews explicitly.
                ...(careerIds.length > 0
                    ? { id: { $in: careerIds } }
                    : archivedCareerIds.length > 0
                        ? { id: { $nin: archivedCareerIds } }
                        : {}),
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: "%Y-%m-%d",
                        date: { $toDate: "$applicationMetadata.updatedAt" }
                    }
                },
                hires: { $sum: 1 }
            }
        },
        {
            $sort: {
                _id: 1
            }
        }
    ]).toArray();

    let currentValue = 0;
    let pastValue = 0;

    if (dateFilter.type === "All-time") {
        currentValue = hires.reduce((acc, curr) => acc + curr.hires, 0);
        pastValue = hires.reduce((acc, curr) => acc + curr.hires, 0);
        timeRangeStart = hires?.length > 0 ? moment(hires[0]?._id).toDate() : moment().startOf("day").toDate();
        timeRangeEnd = moment().startOf("day").toDate();
    } else if (dateFilter.type === "Custom") {
        currentValue = hires.filter((x) => moment(x._id).isSameOrAfter(dateFilter.startDate, "day")).reduce((acc, curr) => acc + curr.hires, 0);
        pastValue = hires.filter((x) => moment(x._id).isSameOrAfter(timeRangeEnd, "day") && moment(x._id).isBefore(timeRangeStart, "day")).reduce((acc, curr) => acc + curr.hires, 0);
    } else {
        currentValue = hires.filter((x) => moment(x._id).isSameOrAfter(timeRangeStart, "day")).reduce((acc, curr) => acc + curr.hires, 0);
        pastValue = hires.filter((x) => moment(x._id).isSameOrAfter(timeRangeEnd, "day") && moment(x._id).isBefore(timeRangeStart, "day")).reduce((acc, curr) => acc + curr.hires, 0);
    }

    const formattedData = [];
    let lastValue = 0;
    for (let date = moment(timeRangeEnd); date.isSameOrBefore(moment()); date.add(1, 'day')) {
        const x = hires.find(x => moment(x._id).isSame(date, "date")) || { _id: date.format('YYYY-MM-DD'), hires: 0 };
        const percentageChange = computePercentChange(x.hires, lastValue);
        lastValue = x.hires;
        formattedData.push({ date: x._id, value: x.hires, percentageChange: percentageChange });
    }
    return {
        currentValue: currentValue,
        pastValue: pastValue,
        percentageChange: computePercentChange(currentValue, pastValue),
        comparedTo: comparedTo,
        data: formattedData,
    };
}

const getApplicationVolume = async (db: any, orgID: string, careerIds: string[], dateFilter: DateFilter, archivedCareerIds: string[] = []) => {
        let matchTime = {};
        let interviewHistoryMatchTime = {};

        switch (dateFilter.type) {
            case "Today":
                const today = moment().startOf("day").toDate();
                matchTime = {
                    createdAt: { $gte: today }
                }
                interviewHistoryMatchTime = { createdAt: { $gte: today.getTime() }, }
                break;

            case "7D":
                const sixDaysAgo = moment().subtract(6, "days").toDate();
                matchTime = {
                    createdAt: { $gte: sixDaysAgo },
                }
                interviewHistoryMatchTime = { createdAt: { $gte: sixDaysAgo.getTime() }, }
                break;
            
            case "30D":
                const thirtyDaysAgo = moment().subtract(30, "days").startOf("day").toDate();
                matchTime = {
                    createdAt: { $gte: thirtyDaysAgo },
                }
                interviewHistoryMatchTime = { createdAt: { $gte: thirtyDaysAgo.getTime() }, }
                break;

            case "3M":
                const threeMonthsAgo = moment().subtract(3, "months").startOf("day").toDate();
                matchTime = {
                    createdAt: { $gte: threeMonthsAgo },
                }
                interviewHistoryMatchTime = { createdAt: { $gte: threeMonthsAgo.getTime() }, }
                break;
            
            case "6M":
                const sixMonthsAgo = moment().subtract(6, "months").startOf("day").toDate();
                matchTime = {
                    createdAt: { $gte: sixMonthsAgo },
                }
                interviewHistoryMatchTime = { createdAt: { $gte: sixMonthsAgo.getTime() }, }
                break;
            
            case "12M":
                const twelveMonthsAgo = moment().subtract(12, "months").startOf("day").toDate();
                matchTime = {
                    createdAt: { $gte: twelveMonthsAgo },
                }
                interviewHistoryMatchTime = { createdAt: { $gte: twelveMonthsAgo.getTime() }, }
                break;
            
            case "All-time":
                matchTime = {}
                break;
            case "Custom":
                matchTime = {
                    createdAt: { $gte: dateFilter.startDate, $lt: dateFilter.endDate }
                }
                interviewHistoryMatchTime = { createdAt: { $gte: dateFilter.startDate.getTime(), $lt: dateFilter.endDate.getTime() } }
                break;
            default:
                const defaultDate = moment().subtract(6, "days").toDate();
                matchTime = {
                    createdAt: { $gte: defaultDate },
                }
                interviewHistoryMatchTime = { createdAt: { $gte: defaultDate.getTime() }, }
                break;
        }
        const applicationVolume = await db.collection("interviews").aggregate([
            {
                $match: {
                    orgID: orgID,
                    ...matchTime,
                    // Same archived-exclusion contract as getHires above.
                    ...(careerIds.length > 0
                        ? { id: { $in: careerIds } }
                        : archivedCareerIds.length > 0
                            ? { id: { $nin: archivedCareerIds } }
                            : {}),
                }
            },
            {
                $lookup: {
                    from: "interview-history",
                    let: { interviewUID: { $toString: "$_id" } },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$interviewUID", "$$interviewUID"] },
                                ...interviewHistoryMatchTime,
                                action: "Auto-Promoted"
                            }
                        },
                        { $limit: 1 },
                    ],
                    as: "history"
                }
            },
            {
                $unwind: {
                    path: "$history",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    convertedDate: {
                        $toDate: "$createdAt"
                    }
                }
            },
            {
                $group: {
                    _id: {
                        // $dayOfWeek: "$convertedDate",
                        $dateToString: { format: "%Y-%m-%d", date: "$convertedDate" }
                    },
                    applicationVolume: { $sum: 1 },
                    automaticallyEndorsed: { $sum: { $cond: [{ $eq: ["$history.action", "Auto-Promoted"] }, 1, 0] } }
                }
            },
            {
                $sort: {
                    _id: 1
                }
            },
            {
                $project: {
                  _id: 0,
                  date: "$_id",
                  applicationVolume: 1,
                  automaticallyEndorsed: 1,
                }
              },
        ]).toArray();
        return {
            days: applicationVolume.map((dayData) => ({
                date: dayData.date,
                applicationVolume: dayData.applicationVolume,
                automaticallyEndorsed: dayData.automaticallyEndorsed,
            })),
        };
}

const getDropOffRate = async (db: any, orgID: string, activeCareers: string[], dateFilter: DateFilter) => {
    let matchTime = {};
    let startDate;
    let endDate;

    switch (dateFilter.type) {
        case "Today":
            startDate = moment().startOf("day").toDate();
            matchTime = { createdAt: { $gte: startDate } }
            break;
        case "7D":
            startDate = moment().subtract(6, "days").startOf("day").toDate();
            endDate = moment().startOf("day").toDate();
            matchTime = { createdAt: { $gte: startDate } }
            break;
        case "30D":
            startDate = moment().subtract(30, "days").startOf("day").toDate();
            endDate = moment().startOf("day").toDate();
            matchTime = { createdAt: { $gte: startDate } }
            break;
        case "6M":
            startDate = moment().subtract(6, "months").startOf("day").toDate();
            endDate = moment().startOf("day").toDate();
            matchTime = { createdAt: { $gte: startDate } }
            break;
        case "12M":
            startDate = moment().subtract(12, "months").startOf("day").toDate();
            endDate = moment().startOf("day").toDate();
            matchTime = { createdAt: { $gte: startDate } }
            break;
        case "All-time":
            matchTime = {}
            break;
        case "Custom":
            startDate = dateFilter.startDate;
            endDate = dateFilter.endDate;
            matchTime = { createdAt: { $gte: dateFilter.startDate, $lt: dateFilter.endDate } }
            break;
        default:
            startDate = moment().subtract(3, "months").startOf("month").toDate();
            endDate = moment().startOf("day").toDate();
            matchTime = { createdAt: { $gte: startDate } }
            break;
    }
    const dropOffRate = await db.collection("interviews").aggregate([
        {
            $match: {
                orgID: orgID, 
                ...matchTime,
                ...(activeCareers.length > 0 ? { id: { $in: activeCareers } } : {}),
            }
        },
        {
            $lookup: {
                from: "interview-history",
                let: { interviewUID: { $toString: "$_id" } },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$interviewUID", "$$interviewUID"] },
                        }
                    }
                ],
                as: "history"
            }
        },
        {
            $facet: {
                totalApplicants: [
                    {
                        $count: "count"
                    }
                ],
                stageDurations: [
                    {
                        $unwind: {
                            path: "$history",
                            preserveNullAndEmptyArrays: false
                        }
                    },
                    {
                        $sort: {
                            interviewUID: 1,
                            "history.createdAt": 1
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            transitions: {
                                $push: {
                                    toStageId: "$history.toStageId",
                                    toSubstageId: "$history.toSubstageId",
                                    fromStageId: "$history.fromStageId",
                                    fromSubstageId: "$history.fromSubstageId",
                                    action: "$history.action",
                                    createdAt: "$history.createdAt"
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            stageDurations: {
                                $map: {
                                    input: { $range: [0, { $subtract: [{ $size: "$transitions" }, 1] }] },
                                    as: "idx",
                                    in: {
                                        stageId: {
                                            $cond: [
                                                {
                                                  $in: [
                                                    { $arrayElemAt: ["$transitions.action", "$$idx"] },
                                                    ["Dropped", "Cancelled", "Reconsidered"]
                                                  ]
                                                },
                                                { $arrayElemAt: ["$transitions.fromStageId", "$$idx"] },
                                                { $arrayElemAt: ["$transitions.toStageId", "$$idx"] }
                                            ]
                                        },
                                        substageId: {
                                            $cond: [
                                                {
                                                  $in: [
                                                    { $arrayElemAt: ["$transitions.action", "$$idx"] },
                                                    ["Dropped", "Cancelled", "Reconsidered"]
                                                  ]
                                                },
                                                { $arrayElemAt: ["$transitions.fromSubstageId", "$$idx"] },
                                                { $arrayElemAt: ["$transitions.toSubstageId", "$$idx"] }
                                            ] 
                                        },
                                        startTime: { $arrayElemAt: ["$transitions.createdAt", "$$idx"] },
                                        endTime: { $arrayElemAt: ["$transitions.createdAt", { $add: ["$$idx", 1] }] },
                                        durationMs: {
                                            $subtract: [
                                                { $arrayElemAt: ["$transitions.createdAt", { $add: ["$$idx", 1] }] },
                                                { $arrayElemAt: ["$transitions.createdAt", "$$idx"] }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    },
                    {
                        $unwind: {
                            path: "$stageDurations",
                            preserveNullAndEmptyArrays: false
                        }
                    },
                    {
                        $match: {
                            "stageDurations.durationMs": { $gt: 0 },
                            "stageDurations.stageId": { $exists: true, $nin: [null, ""] }
                        }
                    },
                    {
                        $group: {
                            _id: {
                                stageId: "$stageDurations.stageId",
                                substageId: "$stageDurations.substageId",
                            },
                            avgDurationMs: { $avg: "$stageDurations.durationMs" },
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            stageId: "$_id.stageId",
                            substageId: "$_id.substageId",
                            avgDurationDays: { $round: [{ $divide: ["$avgDurationMs", 86400000] }, 1] },
                        }
                    }
                ],
                cvScreeningApplied: [
                    {
                        $unwind: {
                            path: "$history",
                            preserveNullAndEmptyArrays: false
                        }
                    },
                    {
                        $match: {
                            "history.fromStage": "Applied",
                            "history.action": { $in: ["Cancelled", "Dropped"] },
                        },
                    },
                    {
                        $group: {
                            _id: "$history.action",
                            count: { $sum: 1 },
                        }
                    }
                ],
                cvScreeningReview: [
                    {
                        $unwind: {
                            path: "$history",
                            preserveNullAndEmptyArrays: false
                        }
                    },
                    {
                        $match: {
                            "history.fromStageId": "1",
                            "history.fromSubstageId": "2",
                            "history.action": { $in: ["Cancelled", "Dropped", "Reconsidered", "Endorsed", "Auto-Promoted"] },
                        }
                    },
                    {
                        $sort: {
                            "history.createdAt": -1
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            
                            action: { $first: "$history.action" },
                            createdAt: { $first: "$history.createdAt" },
                        }
                    }
                ],
                pendingAIInterview: [
                    {
                        $unwind: {
                            path: "$history",
                            preserveNullAndEmptyArrays: false
                        }
                    },
                    {
                        $match: {
                            $or: [
                                {
                                    "history.fromStageId": "2",
                                    "history.fromSubstageId": "1",
                                    "history.action": { $in: ["Cancelled", "Dropped", "Reconsidered"] },
                                },
                                {
                                    "history.toStageId": "2",
                                    "history.toSubstageId": "1",
                                    "history.action": { $in: ["Endorsed", "Auto-Promoted", "Direct Link Promotion"] },
                                }
                            ]
                        },
                    },
                    {
                        $sort: {
                            "history.createdAt": -1
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            action: { $first: "$history.action" },
                            createdAt: { $first: "$history.createdAt" },
                        }
                    }
                ],
                aiInterviewReview: [
                    {
                        $unwind: {
                            path: "$history",
                            preserveNullAndEmptyArrays: false
                        }
                    },
                    {
                        $match: {
                            $or: [
                                {
                                    "history.fromStageId": "2",
                                    "history.fromSubstageId": "2",
                                    "history.action": { $in: ["Cancelled", "Dropped", "Reconsidered"] },
                                },
                                {
                                    "history.toStageId": "2",
                                    "history.toSubstageId": "2",
                                    "history.action": { $in: ["Endorsed", "Auto-Promoted"] },
                                }
                            ]
                        },
                    },
                    {
                        $sort: {
                            "history.createdAt": -1
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            
                            action: { $first: "$history.action" },
                            createdAt: { $first: "$history.createdAt" },
                        }
                    }
                ],
                humanInterviewSchedule: [
                    {
                        $unwind: {
                            path: "$history",
                            preserveNullAndEmptyArrays: false
                        }
                    },
                    {
                        $match: {
                            $or: [
                                {
                                    "history.fromStageId": "3",
                                    "history.fromSubstageId": "1",
                                    "history.action": { $in: ["Cancelled", "Dropped", "Reconsidered"] },
                                },
                                {
                                    "history.toStageId": "3",
                                    "history.toSubstageId": "1",
                                    "history.action": "Endorsed",
                                },    
                            ]
                        }
                    },
                    {
                        $sort: {
                            "history.createdAt": -1
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            
                            action: { $first: "$history.action" },
                            createdAt: { $first: "$history.createdAt" },
                        }
                    }
                ],
                 pendingHumanInterview: [
                    {
                        $unwind: {
                            path: "$history",
                            preserveNullAndEmptyArrays: false
                        }
                    },
                    {
                        $match: {
                            $or: [
                                {
                                    "history.fromStageId": "3",
                                    "history.fromSubstageId": "2",
                                    "history.action": { $in: ["Cancelled", "Dropped", "Reconsidered"] },
                                },
                                {
                                    "history.toStageId": "3",
                                    "history.toSubstageId": "2",
                                    "history.action": "Endorsed",
                                }
                            ]
                        }
                    },
                    {
                        $sort: {
                            "history.createdAt": -1
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            
                            action: { $first: "$history.action" },
                            createdAt: { $first: "$history.createdAt" },
                        }
                    }
                ],
                 humanInterviewReview: [
                    {
                        $unwind: {
                            path: "$history",
                            preserveNullAndEmptyArrays: false
                        }
                    },
                    {
                        $match: {
                            $or: [
                                {
                                    "history.fromStageId": "3",
                                    "history.fromSubstageId": "3",
                                    "history.action": { $in: ["Cancelled", "Dropped", "Reconsidered"] },
                                },
                                {
                                    "history.toStageId": "3",
                                    "history.toSubstageId": "3",
                                    "history.action": "Endorsed",
                                }
                            ]
                        }
                    },
                    {
                        $sort: {
                            "history.createdAt": -1
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            
                            action: { $first: "$history.action" },
                            createdAt: { $first: "$history.createdAt" },
                        }
                    }
                ],
                // Job Offer stage
                jobOfferReview: [
                    {
                        $unwind: {
                            path: "$history",
                            preserveNullAndEmptyArrays: false
                        }
                    },
                    {
                        $match: {
                            $or: [
                                {
                                    "history.fromStageId": "4",
                                    "history.fromSubstageId": "1",
                                    "history.action": { $in: ["Cancelled", "Dropped", "Reconsidered"] },
                                },
                                {
                                    "history.toStageId": "4",
                                    "history.toSubstageId": "1",
                                    "history.action": "Endorsed",
                                }
                            ]
                        }
                    },
                    {
                        $sort: {
                            "history.createdAt": -1
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            action: { $first: "$history.action" },
                            createdAt: { $first: "$history.createdAt" },
                        }
                    }
                ],
                 jobOfferAcceptance: [
                    {
                        $unwind: {
                            path: "$history",
                            preserveNullAndEmptyArrays: false
                        }
                    },
                    {
                        $match: {
                            $or: [
                                {
                                    "history.fromStageId": "4",
                                    "history.fromSubstageId": "2",
                                    "history.action": { $in: ["Cancelled", "Dropped", "Reconsidered"] },
                                },
                                {
                                    "history.toStageId": "4",
                                    "history.toSubstageId": "2",
                                    "history.action": "Endorsed",
                                }
                            ]
                        }
                    },
                    {
                        $sort: {
                            "history.createdAt": -1
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",                       
                            action: { $first: "$history.action" },
                            createdAt: { $first: "$history.createdAt" },
                        }
                    }
                ],
                 jobOfferContractSigning: [
                    {
                        $unwind: {
                            path: "$history",
                            preserveNullAndEmptyArrays: false
                        }
                    },
                    {
                        $match: {
                            $or: [
                                {
                                    "history.fromStageId": "4",
                                    "history.fromSubstageId": "3",
                                    "history.action": { $in: ["Cancelled", "Dropped", "Reconsidered"] },
                                },
                                {
                                    "history.toStageId": "4",
                                    "history.toSubstageId": "3",
                                    "history.action": "Endorsed",
                                }
                            ]
                        }
                    },
                    {
                        $sort: {
                            "history.createdAt": -1
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            
                            action: { $first: "$history.action" },
                            createdAt: { $first: "$history.createdAt" },
                        }
                    }
                ],
                 jobOfferHired: [
                    {
                        $unwind: {
                            path: "$history",
                            preserveNullAndEmptyArrays: false
                        }
                    },
                    {
                        $match: {
                            $or: [
                                {
                                    "history.fromStageId": "4",
                                    "history.fromSubstageId": "4",
                                    "history.action": { $in: ["Cancelled", "Dropped", "Reconsidered"] },
                                },
                                {
                                    "history.toStageId": "4",
                                    "history.toSubstageId": "4",
                                    "history.action": "Endorsed",
                                }
                            ]
                        }
                    },
                    {
                        $sort: {
                            "history.createdAt": -1
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            action: { $first: "$history.action" },
                            createdAt: { $first: "$history.createdAt" },
                        }
                    }
                ]
            }
        }
    ]).toArray();
    const dropOffData = dropOffRate[0];
    const totalApplicantCount = dropOffData.totalApplicants?.[0]?.count || 0;
    const stages: any[] = [
        {
            group: "CV Screening",
            substages: [
                {
                    name: "CV Screening: Waiting Submission",
                    totalCandidates: totalApplicantCount,
                    droppedCount: dropOffData.cvScreeningApplied?.reduce((acc: number, curr: any) => acc + curr.count, 0) || 0,
                    droppedByCancellation: dropOffData.cvScreeningApplied?.find((item: any) => item._id === "Cancelled")?.count || 0,
                    droppedByRecruiter: dropOffData.cvScreeningApplied?.find((item: any) => item._id === "Dropped")?.count || 0,
                    remainingCandidates: totalApplicantCount,
                    percentage: parseFloat((((totalApplicantCount - (dropOffData.cvScreeningApplied?.reduce((acc: number, curr: any) => acc + curr.count, 0) || 0)) / totalApplicantCount) * 100).toFixed(1)) || 0,
                    droppedPercentage: parseFloat(((dropOffData.cvScreeningApplied?.reduce((acc: number, curr: any) => acc + curr.count, 0) || 0) / totalApplicantCount * 100).toFixed(1)) || 0,
                    averageStageDuration: dropOffData.stageDurations?.find((item: any) => item.stageId === "1" && item.substageId === "2")?.avgDurationDays || 0,
                    remainingPercentage: parseFloat(((totalApplicantCount / totalApplicantCount) * 100).toFixed(1)) || 0,
                    cancellationPercentage: parseFloat((((dropOffData.cvScreeningApplied?.find((item: any) => item._id === "Cancelled")?.count || 0) / totalApplicantCount) * 100).toFixed(1)) || 0,
                    droppedByRecruiterPercentage: parseFloat((((dropOffData.cvScreeningApplied?.find((item: any) => item._id === "Dropped")?.count || 0) / totalApplicantCount) * 100).toFixed(1)) || 0,
                },
                {
                    name: "CV Screening: For Review",
                    ...getDroppedCalculations(dropOffData.cvScreeningReview, totalApplicantCount),
                    averageStageDuration: dropOffData.stageDurations?.find((item: any) => item.stageId === "1" && item.substageId === "2")?.avgDurationDays || 0,
                }
            ]
        },
        {
            group: "AI Interview",
            substages: [
                {
                    name: "AI Interview: Waiting Interview",
                    ...getDroppedCalculations(dropOffData.pendingAIInterview, totalApplicantCount),
                    averageStageDuration: dropOffData.stageDurations?.find((item: any) => item.stageId === "2" && item.substageId === "1")?.avgDurationDays || 0,
                },
                {
                    name: "AI Interview: For Review",
                    ...getDroppedCalculations(dropOffData.aiInterviewReview, totalApplicantCount),
                    averageStageDuration: dropOffData.stageDurations?.find((item: any) => item.stageId === "2" && item.substageId === "2")?.avgDurationDays || 0,
                }
            ]
        },
        {
            group: "Human Interview",
            substages: [
                {
                    name: "Human Interview: Waiting Schedule",
                    ...getDroppedCalculations(dropOffData.humanInterviewSchedule, totalApplicantCount),
                    averageStageDuration: dropOffData.stageDurations?.find((item: any) => item.stageId === "3" && item.substageId === "1")?.avgDurationDays || 0,
                },
                {
                    name: "Human Interview: Waiting Interview",
                    ...getDroppedCalculations(dropOffData.pendingHumanInterview, totalApplicantCount),
                    averageStageDuration: dropOffData.stageDurations?.find((item: any) => item.stageId === "3" && item.substageId === "2")?.avgDurationDays || 0,
                },
                {
                    name: "Human Interview: For Review",
                    ...getDroppedCalculations(dropOffData.humanInterviewReview, totalApplicantCount),
                    averageStageDuration: dropOffData.stageDurations?.find((item: any) => item.stageId === "3" && item.substageId === "3")?.avgDurationDays || 0,
                }
            ]
        },
        {
            group: "Job Offer",
            substages: [
                {
                    name: "Job Offer: For Final Review",
                    ...getDroppedCalculations(dropOffData.jobOfferReview, totalApplicantCount),
                    averageStageDuration: dropOffData.stageDurations?.find((item: any) => item.stageId === "4" && item.substageId === "1")?.avgDurationDays || 0,
                },
                {
                    name: "Job Offer: Waiting Offer Acceptance",
                    ...getDroppedCalculations(dropOffData.jobOfferAcceptance, totalApplicantCount),
                    averageStageDuration: dropOffData.stageDurations?.find((item: any) => item.stageId === "4" && item.substageId === "2")?.avgDurationDays || 0,
                },
                {
                    name: "Job Offer: For Contract Signing",
                    ...getDroppedCalculations(dropOffData.jobOfferContractSigning, totalApplicantCount),
                    averageStageDuration: dropOffData.stageDurations?.find((item: any) => item.stageId === "4" && item.substageId === "3")?.avgDurationDays || 0,
                },
                {
                    name: "Job Offer: Hired",
                    ...getDroppedCalculations(dropOffData.jobOfferHired, totalApplicantCount),
                    averageStageDuration: dropOffData.stageDurations?.find((item: any) => item.stageId === "4" && item.substageId === "4")?.avgDurationDays || 0,
                }
            ]
        },
    ];
    for (const stage of stages) {
        let groupPercentage = 0;
        const lastSubstage = stage.substages[stage.substages.length - 1];
        groupPercentage = lastSubstage.remainingCandidates / totalApplicantCount * 100;
        stage.groupPercentage = parseFloat(groupPercentage.toFixed(0));
    }
    return {
        dateRange: {
            startDate,
            endDate,
        },
        totalApplicants: totalApplicantCount,
        stages: stages,
    };
}

const getDroppedCalculations = (dropOffData: any[], totalCandidates: number) => {
    const droppedCount = dropOffData?.filter((item: any) => item.action === "Dropped" || item.action === "Cancelled")?.length || 0;
    const droppedByCancellation = dropOffData?.filter((item: any) => item.action === "Cancelled")?.length || 0;
    const droppedByRecruiter = dropOffData?.filter((item: any) => item.action === "Dropped")?.length || 0;
    const remainingCandidates = dropOffData?.length;
    const droppedPercentage = parseFloat(((droppedCount / remainingCandidates) * 100).toFixed(1)) || 0;
    const percentage = parseFloat(((100 - droppedPercentage).toFixed(1))) || 0;
    const remainingPercentage = parseFloat(((remainingCandidates / totalCandidates) * 100).toFixed(1)) || 0;
    const cancellationPercentage = parseFloat(((droppedByCancellation / remainingCandidates) * 100).toFixed(1)) || 0;
    const droppedByRecruiterPercentage = parseFloat(((droppedByRecruiter / remainingCandidates) * 100).toFixed(1)) || 0;

    return {
        droppedCount,
        droppedByCancellation,
        cancellationPercentage,
        droppedByRecruiter,
        droppedByRecruiterPercentage,
        remainingCandidates,
        percentage,
        droppedPercentage,
        totalCandidates,
        remainingPercentage,
    }
}

const getStageAging = async (db: any, orgID: string, careerIds: string[], dateFilter: DateFilter) => {
    let matchTime = {};

    switch (dateFilter.type) {
        case "Today":
            const today = moment().startOf("day").toDate();
            matchTime = { createdAt: { $gte: today.getTime() } }
            break;
        case "7D":
            const sevenDaysAgo = moment().subtract(7, "days").startOf("day").toDate();
            matchTime = { createdAt: { $gte: sevenDaysAgo.getTime() } }
            break;
        case "30D":
            const thirtyDaysAgo = moment().subtract(30, "days").startOf("day").toDate();
            matchTime = { createdAt: { $gte: thirtyDaysAgo.getTime() } }
            break;
        case "6M":
            const sixMonthsAgo = moment().subtract(6, "months").startOf("day").toDate();
            matchTime = { createdAt: { $gte: sixMonthsAgo.getTime() } }
            break;
        case "12M":
            const twelveMonthsAgo = moment().subtract(12, "months").startOf("day").toDate();
            matchTime = { createdAt: { $gte: twelveMonthsAgo.getTime() } }
            break;
        case "All-time":
            matchTime = {}
            break;
        case "Custom":
            matchTime = { createdAt: { $gte: dateFilter.startDate.getTime(), $lt: dateFilter.endDate.getTime() } }
            break;
        default:
            const threeMonthsAgo = moment().subtract(3, "months").startOf("month").toDate();
            matchTime = { createdAt: { $gte: threeMonthsAgo.getTime() } }
            break;
    }

     // Stage Aging Analysis - Average time spent in each stage/substage per career
     const nowMs = Date.now();
     const stageAging = await db.collection("interview-history").aggregate([
        {
            $match: {
                ...(careerIds.length > 0 ? { careerId: { $in: careerIds } } : {}),
                ...matchTime,
            }
        },
        // Sort by interview and time to prepare for pairing
        {
            $sort: {
                interviewUID: 1,
                createdAt: 1
            }
        },
        {
            // Lookup to filter by orgID through careers
            $lookup: {
                from: "careers",
                let: { careerId: "$careerId" },
                pipeline: [
                    {
                        $addFields: {
                          _id: { $toString: "$_id" },
                        },
                      },
                    {
                        $match: {
                            $expr: { $eq: ["$_id", "$$careerId"] },
                            orgID: orgID,
                            ...EXCLUDE_ARCHIVED,
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            id: 1,
                            jobTitle: 1,
                            pipelineStages: 1
                        }
                    }
                ],
                as: "career"
            }
        },
        {
            $unwind: {
                path: "$career",
                preserveNullAndEmptyArrays: false
            }
        },
        // Group by interview to get consecutive transitions
        {
            $group: {
                _id: "$interviewUID",
                careerId: { $first: "$careerId" },
                careerJobTitle: { $first: "$career.jobTitle" },
                careerPipelineStages: { $first: "$career.pipelineStages" },
                transitions: {
                    $push: {
                        toStageId: "$toStageId",
                        toSubstageId: "$toSubstageId",
                        fromStageId: "$fromStageId",
                        fromSubstageId: "$fromSubstageId",
                        action: "$action",
                        createdAt: "$createdAt"
                    }
                }
            }
        },
        { $addFields: { nowMs } },
        // Calculate duration for each stage/substage
        {
            $project: {
                careerId: 1,
                careerJobTitle: 1,
                careerPipelineStages: 1,
                stageDurations: {
                    $map: {
                        input: {
                            $cond: [
                                { $eq: [{ $size: "$transitions" }, 1] },
                                [0, 1],
                                { $range: [0, { $subtract: [{ $size: "$transitions" }, 1] }] }
                            ]
                        },
                        as: "idx",
                        in: {
                            stageId: {
                                $cond: [
                                    {
                                      $in: [
                                        { $arrayElemAt: ["$transitions.action", "$$idx"] },
                                        ["Dropped", "Cancelled", "Reconsidered"]
                                      ]
                                    },
                                    { $arrayElemAt: ["$transitions.fromStageId", "$$idx"] },
                                    { $arrayElemAt: ["$transitions.toStageId", "$$idx"] }
                                ]
                            },
                            substageId: {
                                $cond: [
                                    {
                                      $in: [
                                        { $arrayElemAt: ["$transitions.action", "$$idx"] },
                                        ["Dropped", "Cancelled", "Reconsidered"]
                                      ]
                                    },
                                    { $arrayElemAt: ["$transitions.fromSubstageId", "$$idx"] },
                                    { $arrayElemAt: ["$transitions.toSubstageId", "$$idx"] }
                                ] 
                            },
                            startTime: { $arrayElemAt: ["$transitions.createdAt", "$$idx"] },
                            endTime: {
                                $ifNull: [
                                    { $arrayElemAt: ["$transitions.createdAt", { $add: ["$$idx", 1] }] },
                                    "$nowMs"
                                ]
                            },
                            durationMs: {
                                $subtract: [
                                    {
                                        $ifNull: [
                                            { $arrayElemAt: ["$transitions.createdAt", { $add: ["$$idx", 1] }] },
                                            "$nowMs"
                                        ]
                                    },
                                    { $arrayElemAt: ["$transitions.createdAt", "$$idx"] }
                                ]
                            }
                        }
                    }
                }
            }
        },
        // Unwind to work with individual stage durations
        {
            $unwind: {
                path: "$stageDurations",
                preserveNullAndEmptyArrays: false
            }
        },
        // Filter out any invalid durations (negative, null, or missing stageId)
        // This ensures we only count actual stages, not drop/cancel events
        // BUT drop/cancel events are still used as exit timestamps in the pairing
        {
            $match: {
                "stageDurations.durationMs": { $gt: 0 },
                "stageDurations.stageId": { $exists: true, $nin: [null, ""] }
            }
        },
        // Add stage name from career.pipelineStages
        {
            $addFields: {
                "stageDurations.stageName": {
                    $let: {
                        vars: {
                            matchedStage: {
                                $arrayElemAt: [
                                    {
                                        $filter: {
                                            input: { $ifNull: ["$careerPipelineStages", DEFAULT_JOB_PIPELINE] },
                                            as: "stage",
                                            cond: { $eq: ["$$stage.id", "$stageDurations.stageId"] }
                                        }
                                    },
                                    0
                                ]
                            }
                        },
                        in: {
                            $let: {
                                vars: {
                                    matchedSubstage: {
                                        $arrayElemAt: [
                                            {
                                                $filter: {
                                                    input: { $ifNull: ["$$matchedStage.substages", []] },
                                                    as: "substage",
                                                    cond: { $eq: ["$$substage.id", "$stageDurations.substageId"] }
                                                }
                                            },
                                            0
                                        ]
                                    }
                                },
                                in: {
                                    $ifNull: [{$concat: ["$$matchedStage.name", " - ", "$$matchedSubstage.name"]}, "Unknown Stage"]
                                }
                            }
                        }
                    }
                },
                // Stage index based on career pipeline stages
                "stageDurations.stageIndex": {
                    $let: {
                        vars: {
                            stageId: "$stageDurations.stageId",
                            pipelineStages: { $ifNull: ["$careerPipelineStages", DEFAULT_JOB_PIPELINE] }
                        },
                        in: {
                            $let: {
                                vars: {
                                    stageIds: {
                                        $map: {
                                            input: {
                                                $filter: {
                                                    input: "$$pipelineStages",
                                                    as: "stage",
                                                    cond: { $ne: ["$$stage.enabled", false] }
                                                }
                                            },
                                            as: "stage",
                                            in: "$$stage.id"
                                        }
                                    }
                                },
                                in: {
                                    $let: {
                                        vars: {
                                            index: { $indexOfArray: ["$$stageIds", "$$stageId"] }
                                        },
                                        in: {
                                            $cond: [
                                                { $ne: ["$$index", -1] },
                                                "$$index",
                                                null
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
            }
        },
        // Remove unknown stage durations
        {
            $match: {
                "stageDurations.stageIndex": { $ne: null },
                "stageDurations.stageName": { $ne: "Unknown Stage" }
            }
        },
        {
            $addFields: {
                "stageDurations.substageIndex": {
                    $let: {
                        vars: {
                            stageId: "$stageDurations.stageId",
                            substageId: "$stageDurations.substageId",
                            pipelineStages: { $ifNull: ["$careerPipelineStages", DEFAULT_JOB_PIPELINE] }
                        },
                        in: {
                            $let: {
                                vars: {
                                    matchedStage: {
                                        $arrayElemAt: [
                                            {
                                                $filter: {
                                                    input: "$$pipelineStages",
                                                    as: "stage",
                                                    cond: { 
                                                        $and: [
                                                            { $eq: ["$$stage.id", "$$stageId"] },
                                                            { $ne: ["$$stage.enabled", false] }
                                                        ]
                                                    }
                                                }
                                            },
                                            0
                                        ]
                                    }
                                },
                                in: {
                                    $let: {
                                        vars: {
                                            substages: {
                                                $cond: {
                                                    if: { $or: [
                                                        { $eq: [ "$$matchedStage.substages", undefined ] },
                                                        { $eq: [ "$$matchedStage.substages", null ] }
                                                    ]},
                                                    then: [],
                                                    else: "$$matchedStage.substages"
                                                }
                                            },
                                        },
                                        in: {
                                            $let: {
                                                vars: {
                                                    index: { 
                                                        $indexOfArray: [
                                                            { $map: {
                                                                input: "$$substages",
                                                                as: "substage",
                                                                in: "$$substage.id"
                                                            } },
                                                            "$$substageId"
                                                        ]
                                                    }
                                                },
                                                in: {
                                                    $cond: [
                                                        { $ne: ["$$index", -1] },
                                                        "$$index",
                                                        null
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        // Group by career and stage to calculate averages
        {
            $group: {
                _id: {
                    careerId: "$careerId",
                    careerJobTitle: "$careerJobTitle",
                    stageId: "$stageDurations.stageId",
                    substageId: "$stageDurations.substageId",
                    stageName: "$stageDurations.stageName",
                    stageIndex: "$stageDurations.stageIndex",
                    substageIndex: "$stageDurations.substageIndex"
                },
                avgDurationMs: { $avg: "$stageDurations.durationMs" },
                minDurationMs: { $min: "$stageDurations.durationMs" },
                maxDurationMs: { $max: "$stageDurations.durationMs" },
                applicantCount: { $sum: 1 }
            }
        },
        // Convert milliseconds to days
        {
            $project: {
                _id: 0,
                careerId: "$_id.careerId",
                careerJobTitle: "$_id.careerJobTitle",
                stageId: "$_id.stageId",
                substageId: "$_id.substageId",
                stageName: "$_id.stageName",
                stageIndex: "$_id.stageIndex",
                substageIndex: "$_id.substageIndex",
                avgDurationDays: { $divide: ["$avgDurationMs", 86400000] }, // Convert ms to days
                minDurationDays: { $divide: ["$minDurationMs", 86400000] },
                maxDurationDays: { $divide: ["$maxDurationMs", 86400000] },
                applicantCount: 1
            }
        },
        // Sort by career and then by stage order
        {
            $sort: {
                careerId: 1,
                stageIndex: 1,
                substageIndex: 1,
            }
        },
        // Group back by career to create nested structure
        {
            $group: {
                _id: {
                    careerId: "$careerId",
                    careerJobTitle: "$careerJobTitle"
                },
                stages: {
                    $push: {
                        stageId: "$stageId",
                        substageId: "$substageId",
                        stageName: "$stageName",
                        avgDurationDays: { $round: ["$avgDurationDays", 3] },
                        minDurationDays: { $round: ["$minDurationDays", 3] },
                        maxDurationDays: { $round: ["$maxDurationDays", 3] },
                        applicantCount: "$applicantCount"
                    }
                },
                totalAvgDurationDays: { $sum: "$avgDurationDays" }
            }
        },
        {
            $match: {
                totalAvgDurationDays: { $gte: 1 }
            }
        },
    ]).toArray();
    // Sort by total duration to get top careers
    return stageAging.sort((a: any, b: any) => b.totalAvgDurationDays - a.totalAvgDurationDays);
}

const getOfferAcceptanceRate = async (db: any, orgID: string, careerFilter: ObjectId[], dateFilter: DateFilter) => {
    // Setup rolling average parameters for time-series metrics
    const rollingWindowDays = 7;
    let startDate;
    let endDate;

    let matchTime = {};

    switch (dateFilter.type) {
        case "Today":
            const today = moment().startOf("day").toDate();
            matchTime = { createdAt: { $gte: today } }
            startDate = moment(today);
            endDate = moment().endOf("day");
            break;
        case "7D":
            const sevenDaysAgo = moment().subtract(7, "days").startOf("day").toDate();
            matchTime = { createdAt: { $gte: sevenDaysAgo } }
            startDate = moment(sevenDaysAgo);
            endDate = moment().endOf("day");
            break;
        case "30D":
            const thirtyDaysAgo = moment().subtract(30, "days").startOf("day").toDate();
            matchTime = { createdAt: { $gte: thirtyDaysAgo } }
            startDate = moment(thirtyDaysAgo);
            endDate = moment().endOf("day");
            break;
        case "6M":
            const sixMonthsAgo = moment().subtract(6, "months").startOf("day").toDate();
            matchTime = { createdAt: { $gte: sixMonthsAgo } }
            startDate = moment(sixMonthsAgo);
            endDate = moment().endOf("day");
            break;
        case "12M":
            const twelveMonthsAgo = moment().subtract(12, "months").startOf("day").toDate();
            matchTime = { createdAt: { $gte: twelveMonthsAgo } }
            startDate = moment(twelveMonthsAgo);
            endDate = moment().endOf("day");
            break;
        case "All-time":
            matchTime = {}
            endDate = moment().endOf("day");
            break;
        case "Custom":
            matchTime = { createdAt: { $gte: dateFilter.startDate, $lt: dateFilter.endDate } }
            startDate = moment(dateFilter.startDate);
            endDate = moment(dateFilter.endDate);
            break;
        default:
            const threeMonthsAgo = moment().subtract(3, "months").startOf("month").toDate();
            matchTime = { createdAt: { $gte: threeMonthsAgo } }
            startDate = moment(threeMonthsAgo);
            endDate = moment().endOf("day");
            break;
    }

    const offerAcceptanceRateRaw = await db.collection("careers").aggregate([
        {
            $match: {
                orgID: orgID,
                ...EXCLUDE_ARCHIVED,
                ...(careerFilter.length > 0 ? { _id: { $in: careerFilter } } : {}),
            }
        },
        {
            $lookup: {
                from: "recruiter-metrics",
                let: { careerId: { $toString: "$_id" } },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$careerId", "$$careerId"] },
                            ...matchTime,
                        }
                    }
                ],
                as: "recruiterMetrics"
            },
        },
        {
            $unwind: {
                path: "$recruiterMetrics",
                preserveNullAndEmptyArrays: false
            }
        },
        {
            $project: {
                _id: "$_id",
                jobTitle: "$jobTitle",
                metricDate: "$recruiterMetrics.createdAt",
                offerAcceptanceRate: "$recruiterMetrics.offerAcceptanceRate",
            }
        }
    ]).toArray();
    if (!startDate) {
        offerAcceptanceRateRaw.sort((a, b) => new Date(a.metricDate).getTime() - new Date(b.metricDate).getTime());
        startDate = moment(offerAcceptanceRateRaw[0].metricDate);
    }

    // Calculate rolling average with zero-filling for missing dates
    const offerAcceptanceRate = computeRollingAverageWithZeros(startDate, endDate, rollingWindowDays, offerAcceptanceRateRaw);
    return offerAcceptanceRate;
}

const getEndorsementEfficiency = async (db: any, orgID: string, careerFilter: ObjectId[], dateFilter: DateFilter) => {
    let matchTime = {};

    switch (dateFilter.type) {
        case "Today":
            const today = moment().startOf("day").toDate();
            matchTime = { createdAt: { $gte: today.getTime() } }
            break;
        case "7D":
            const sevenDaysAgo = moment().subtract(7, "days").startOf("day").toDate();
            matchTime = { createdAt: { $gte: sevenDaysAgo.getTime() } }
            break;
        case "30D":
            const thirtyDaysAgo = moment().subtract(30, "days").startOf("day").toDate();
            matchTime = { createdAt: { $gte: thirtyDaysAgo.getTime() } }
            break;
        case "3M":
            const threeMonthsAgo = moment().subtract(3, "months").startOf("day").toDate();
            matchTime = { createdAt: { $gte: threeMonthsAgo.getTime() } }
            break;
        case "6M":
            const sixMonthsAgo = moment().subtract(6, "months").startOf("day").toDate();
            matchTime = { createdAt: { $gte: sixMonthsAgo.getTime() } }
            break;
        case "12M":
            const twelveMonthsAgo = moment().subtract(12, "months").startOf("day").toDate();
            matchTime = { createdAt: { $gte: twelveMonthsAgo.getTime() } }
            break;
        case "All-time":
            matchTime = {}
            break;
        case "Custom":
            matchTime = { createdAt: { $gte: dateFilter.startDate.getTime(), $lt: dateFilter.endDate.getTime() } }
            break;
        default:
            const currentMonth = moment().startOf("month").toDate();
            matchTime = { createdAt: { $gte: currentMonth.getTime() } }
            break;
    }
    const endorsementEfficiency = await db.collection("careers").aggregate([
        {
            $match: {
                orgID: orgID,
                ...EXCLUDE_ARCHIVED,
                ...(careerFilter.length > 0 ? { _id: { $in: careerFilter } } : {}),
            }
        },
        {
            $lookup: {
                from: "interview-history",
                let: { careerId: { $toString: "$_id" } },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$$careerId", "$careerId"] },
                            ...matchTime,
                            $or: [
                                { toStageId: "3", action: "Endorsed" }, // Final Interview stage
                                { toStageId: "4", toSubstageId: "4", action: "Endorsed" }  // Hired stage
                            ]
                        },
                    },
                    {
                        $group: {
                            _id: {
                                interviewUID: "$interviewUID",
                                toStageId: "$toStageId",
                            },
                            stageId: { $first: "$toStageId" },
                        }
                    }
                ],
                as: "history"
            }
        },
        {
            $unwind: {
                path: "$history",
                preserveNullAndEmptyArrays: false
            }
        },
        // Group by career
        {
            $group: {
                _id: {
                    _id: "$_id",
                    jobTitle: "$jobTitle",
                },
                endorsements: {
                    $sum: {
                        $cond: [
                            { $and: [
                                { $eq: ["$history.stageId", "3"] },
                            ]},
                            1,
                            0
                        ]
                    }
                },
                hires: {
                    $sum: {
                        $cond: [
                            { $and: [
                                { $eq: ["$history.stageId", "4"] },
                            ]},
                            1,
                            0
                        ]
                    }
                }
            }
        },
        {
            $project: {
                _id: "$_id._id",
                jobTitle: "$_id.jobTitle",
                endorsements: 1,
                hires: 1,
                endorsementEfficiency: {
                    $cond: [
                        { $gt: ["$endorsements", 0] },
                        { $multiply: [{ $divide: ["$hires", "$endorsements"] }, 100] },
                        0
                    ]
                }
            }
        },
        {
            $match: {
                endorsementEfficiency: { $gt: 0 }
            }
        },
        {
            $sort: { endorsementEfficiency: -1 }
        },
    ]).toArray();

    return endorsementEfficiency.map((data: any) => ({
        ...data,
        endorsementEfficiency: data.endorsementEfficiency > 100 ? 100 : parseFloat(data.endorsementEfficiency.toFixed(0)),
    }));
}

const getTimeToHire = async (db: any, orgID: string, careerFilter: ObjectId[], dateFilter: DateFilter) => {
     // Setup rolling average parameters for time-series metrics
     const rollingWindowDays = 7;
     let startDate;
     let endDate;
 
     let matchTime = {};
 
     switch (dateFilter.type) {
         case "Today":
             const today = moment().startOf("day").toDate();
             matchTime = { createdAt: { $gte: today } }
             startDate = moment(today);
             endDate = moment().endOf("day");
             break;
         case "7D":
             const sevenDaysAgo = moment().subtract(7, "days").startOf("day").toDate();
             matchTime = { createdAt: { $gte: sevenDaysAgo } }
             startDate = moment(sevenDaysAgo);
             endDate = moment().endOf("day");
             break;
         case "30D":
             const thirtyDaysAgo = moment().subtract(30, "days").startOf("day").toDate();
             matchTime = { createdAt: { $gte: thirtyDaysAgo } }
             startDate = moment(thirtyDaysAgo);
             endDate = moment().endOf("day");
             break;
         case "6M":
             const sixMonthsAgo = moment().subtract(6, "months").startOf("day").toDate();
             matchTime = { createdAt: { $gte: sixMonthsAgo } }
             startDate = moment(sixMonthsAgo);
             endDate = moment().endOf("day");
             break;
         case "12M":
             const twelveMonthsAgo = moment().subtract(12, "months").startOf("day").toDate();
             matchTime = { createdAt: { $gte: twelveMonthsAgo } }
             startDate = moment(twelveMonthsAgo);
             endDate = moment().endOf("day");
             break;
         case "All-time":
             matchTime = {}
             endDate = moment().endOf("day");
             break;
         case "Custom":
            matchTime = { createdAt: { $gte: dateFilter.startDate, $lt: dateFilter.endDate } }
            startDate = moment(dateFilter.startDate);
            endDate = moment(dateFilter.endDate);
            break;
         default:
             const threeMonthsAgo = moment().subtract(3, "months").startOf("month").toDate();
             matchTime = { createdAt: { $gte: threeMonthsAgo } }
             startDate = moment(threeMonthsAgo);
             endDate = moment().endOf("day");
             break;
     }
    const timeToHireRaw = await db.collection("careers").aggregate([
        {
            $match: {
                orgID: orgID,
                ...EXCLUDE_ARCHIVED,
                ...(careerFilter.length > 0 ? { _id: { $in: careerFilter } } : {}),
            }
        },
        {
            $lookup: {
                from: "recruiter-metrics",
                let: { careerId: { $toString: "$_id" } },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$careerId", "$$careerId"] },
                            ...matchTime,
                        },
                    }
                ],
                as: "recruiterMetrics"
            },
        },
        {
            $unwind: {
                path: "$recruiterMetrics",
                preserveNullAndEmptyArrays: false
            }
        },
        {
            $project: {
                _id: "$_id",
                jobTitle: "$jobTitle",
                metricDate: "$recruiterMetrics.createdAt",
                averageTimeToHire: "$recruiterMetrics.averageTimeToHire",
            }
        }
    ]).toArray();

    if (!startDate) {
        timeToHireRaw.sort((a, b) => new Date(a.metricDate).getTime() - new Date(b.metricDate).getTime());
        startDate = moment(timeToHireRaw[0].metricDate);
    }

    // Calculate rolling 7-day average for smooth continuous line
    const timeToHire = computeRollingAverage(startDate, endDate, rollingWindowDays, timeToHireRaw);
    return timeToHire;
}

const getStagePassRate = async (db: any, orgID: string, careerFilter: string[], dateFilter: DateFilter) => {
    let matchTime = {};
    let startDate;
    let endDate;

    switch (dateFilter.type) {
        case "Today":
            startDate = moment().startOf("day").toDate();
            matchTime = { createdAt: { $gte: startDate.getTime() } }
            break;
        case "7D":
            startDate = moment().subtract(7, "days").startOf("day").toDate();
            endDate = moment().startOf("day").toDate();
            matchTime = { createdAt: { $gte: startDate.getTime() } }
            break;
        case "30D":
            startDate = moment().subtract(30, "days").startOf("day").toDate();
            endDate = moment().startOf("day").toDate();
            matchTime = { createdAt: { $gte: startDate.getTime() } }
            break;
        case "6M":
            startDate = moment().subtract(6, "months").startOf("day").toDate();
            endDate = moment().startOf("day").toDate();
            matchTime = { createdAt: { $gte: startDate.getTime() } }
            break;
        case "12M":
            startDate = moment().subtract(12, "months").startOf("day").toDate();
            endDate = moment().startOf("day").toDate();
            matchTime = { createdAt: { $gte: startDate.getTime() } }
            break;
        case "All-time":
            matchTime = {}
            break;
        case "Custom":
            startDate = dateFilter.startDate;
            endDate = dateFilter.endDate;
            matchTime = { createdAt: { $gte: dateFilter.startDate.getTime(), $lt: dateFilter.endDate.getTime() } }
            break;
        default:
            startDate = moment().subtract(3, "months").startOf("month").toDate();
            endDate = moment().startOf("day").toDate();
            matchTime = { createdAt: { $gte: startDate.getTime() } }
            break;
    }

    const stagePassRateData = await db.collection("interviews").aggregate([
        {
            $match: {
                orgID: orgID,
                ...(careerFilter.length > 0 ? { id: { $in: careerFilter } } : {}),
            }
        },
        {
            $lookup: {
                from: "interview-history",
                let: { interviewUID: { $toString: "$_id" } },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$interviewUID", "$$interviewUID"] },
                            ...matchTime,
                        }
                    },
                    {
                        $sort: { createdAt: 1 }
                    }
                ],
                as: "history"
            }
        },
        {
            $facet: {        
                cvScreening: [
                    {
                        $unwind: {
                            path: "$history",
                            preserveNullAndEmptyArrays: false
                        }
                    },
                    {
                        $match: {
                            $or: [
                                // Dropped
                                {
                                    "history.action": { $in: ["Cancelled", "Dropped"] },
                                    "history.fromStageId": "1",
                                    "history.fromSubstageId": { $in: ["1", "2"] },
                                },
                                // Passed
                                {
                                    "history.action": { $in: ["Endorsed", "Auto-Promoted", "Direct Link Promotion"] },
                                    "history.toStageId": "2",
                                    "history.toSubstageId": "1",
                                    "history.fromStageId": "1",
                                },
                                // Reconsidered
                                {
                                    "history.action": "Reconsidered",
                                    "history.fromStageId": "1",
                                }
                            ]
                        }
                    },
                    {
                        $sort: {
                            "history.createdAt": -1
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            action: { $first: "$history.action" },
                            createdAt: { $first: "$history.createdAt" },
                        }
                    },
                    // Count the number of dropped and passed
                    {
                        $group: {
                            _id: 0,
                            droppedCount: { $sum: { $cond: [{ $in: ["$action", ["Cancelled", "Dropped"]] }, 1, 0] } },
                            passedCount: { $sum: { $cond: [{ $in: ["$action", ["Endorsed", "Auto-Promoted", "Direct Link Promotion"]] }, 1, 0] } },
                        }
                    }
                ],
                aiInterview: [
                    {
                        $unwind: {
                            path: "$history",
                            preserveNullAndEmptyArrays: false
                        }
                    },
                    {
                        $match: {
                            $or: [
                                // Dropped
                                {
                                    "history.action": { $in: ["Cancelled", "Dropped"] },
                                    "history.fromStageId": "2",
                                    "history.fromSubstageId": { $in: ["1", "2"] },
                                },
                                // Passed
                                {
                                    "history.action": "Endorsed",
                                    "history.fromStageId": "2",
                                    "history.fromSubstageId": "2",
                                },
                                // Reconsidered
                                {
                                    "history.action": "Reconsidered",
                                    "history.fromStageId": "2",
                                }
                            ]
                        }
                    },
                    {
                        $sort: {
                            "history.createdAt": -1
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            action: { $first: "$history.action" },
                            createdAt: { $first: "$history.createdAt" },
                        }
                    },
                    // Count the number of dropped and passed
                    {
                        $group: {
                            _id: 0,
                            droppedCount: { $sum: { $cond: [{ $in: ["$action", ["Cancelled", "Dropped"]] }, 1, 0] } },
                            passedCount: { $sum: { $cond: [{ $eq: ["$action", "Endorsed"] }, 1, 0] } },
                        }
                    }
                ],
                humanInterview: [
                    {
                        $unwind: {
                            path: "$history",
                            preserveNullAndEmptyArrays: false
                        }
                    },
                    {
                        $match: {
                            $or: [
                                // Dropped
                                {
                                    "history.action": { $in: ["Cancelled", "Dropped"] },
                                    "history.fromStageId": "3",
                                    "history.fromSubstageId": { $in: ["1", "2", "3"] },
                                },
                                // Passed
                                {
                                    "history.action": "Endorsed",
                                    "history.fromStageId": "3",
                                    "history.toStageId": "4",
                                },
                                // Reconsidered
                                {
                                    "history.action": "Reconsidered",
                                    "history.fromStageId": "3",
                                }
                            ]
                        }
                    },
                    {
                        $sort: {
                            "history.createdAt": -1
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            action: { $first: "$history.action" },
                            createdAt: { $first: "$history.createdAt" },
                        }
                    },
                    // Count the number of dropped and passed
                    {
                        $group: {
                            _id: 0,
                            droppedCount: { $sum: { $cond: [{ $in: ["$action", ["Cancelled", "Dropped"]] }, 1, 0] } },
                            passedCount: { $sum: { $cond: [{ $eq: ["$action", "Endorsed"] }, 1, 0] } },
                        }
                    }
                ],
                jobOffer: [
                    {
                        $unwind: {
                            path: "$history",
                            preserveNullAndEmptyArrays: false
                        }
                    },
                    {
                        $match: {
                            $or: [
                                // Dropped from job offer stage
                                {
                                    "history.action": { $in: ["Cancelled", "Dropped"] },
                                    "history.fromStageId": "4",
                                },
                                // Passed Hired substage
                                {
                                    "history.action": "Endorsed",
                                    "history.toStageId": "4",
                                    "history.toSubstageId": "4",
                                },
                                // Reconsidered Hired substage
                                {
                                    "history.action": "Reconsidered",
                                    "history.fromStageId": "4",
                                    "history.fromSubstageId": "4",
                                }
                            ]
                        }
                    },
                    {
                        $sort: {
                            "history.createdAt": -1
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            action: { $first: "$history.action" },
                            createdAt: { $first: "$history.createdAt" },
                        }
                    },
                    // Count the number of dropped and passed
                    {
                        $group: {
                            _id: 0,
                            droppedCount: { $sum: { $cond: [{ $in: ["$action", ["Cancelled", "Dropped"]] }, 1, 0] } },
                            passedCount: { $sum: { $cond: [{ $in: ["$action", ["Endorsed", "Reconsidered"]] }, 1, 0] } },
                        }
                    }
                ]
            }
        }
    ]).toArray();

    const data = stagePassRateData[0];
    
    // Calculate pass rates for each stage
    const calculatePassRate = (passed: number, dropped: number) => {
        const totalCount = passed + dropped;
        if (totalCount === 0) return 0;
        return parseFloat(((passed / totalCount) * 100).toFixed(1));
    };

    const stages: any[] = [
        {
            group: "CV Screening",
            candidatesPassed: data.cvScreening?.[0]?.passedCount || 0,
            candidatesDropped: data.cvScreening?.[0]?.droppedCount || 0,
            totalCount: (data.cvScreening?.[0]?.passedCount || 0) + (data.cvScreening?.[0]?.droppedCount || 0),
            passRate: calculatePassRate(data.cvScreening?.[0]?.passedCount || 0, data.cvScreening?.[0]?.droppedCount || 0),
        },
        {
            group: "AI Interview",
            candidatesPassed: data.aiInterview?.[0]?.passedCount || 0,
            candidatesDropped: data.aiInterview?.[0]?.droppedCount || 0,
            totalCount: (data.aiInterview?.[0]?.passedCount || 0) + (data.aiInterview?.[0]?.droppedCount || 0),
            passRate: calculatePassRate(data.aiInterview?.[0]?.passedCount || 0, data.aiInterview?.[0]?.droppedCount || 0),
        },
        {
            group: "Human Interview",
            candidatesPassed: data.humanInterview?.[0]?.passedCount || 0,
            candidatesDropped: data.humanInterview?.[0]?.droppedCount || 0,
            totalCount: (data.humanInterview?.[0]?.passedCount || 0) + (data.humanInterview?.[0]?.droppedCount || 0),
            passRate: calculatePassRate(data.humanInterview?.[0]?.passedCount || 0, data.humanInterview?.[0]?.droppedCount || 0),
        },
        {
            group: "Job Offer",
            candidatesPassed: data.jobOffer?.[0]?.passedCount || 0,
            candidatesDropped: data.jobOffer?.[0]?.droppedCount || 0,
            totalCount: (data.jobOffer?.[0]?.passedCount || 0) + (data.jobOffer?.[0]?.droppedCount || 0),
            passRate: calculatePassRate(data.jobOffer?.[0]?.passedCount || 0, data.jobOffer?.[0]?.droppedCount || 0),
        }
    ];

    return {
        dateRange: {
            startDate,
            endDate,
        },
        stages: stages,
    };
}

const computePercentChange = (current: number, previous: number) => {
    if (previous === 0) {
        return "0.00";
    }
    return (((current - previous) / previous) * 100).toFixed(2);
}

const computeRollingAverage = (startDate: moment.Moment, endDate: moment.Moment, rollingWindowDays: number, timeToHireRaw: { jobTitle: string, metricDate: string, averageTimeToHire: number }[]) => {
    const timeToHire = [];
    let lastKnownValue = 0;
    for (let date = startDate.clone(); date.isSameOrBefore(endDate); date.add(1, 'day')) {
        const windowStart = date.clone().subtract(rollingWindowDays - 1, 'days').startOf('day');
        const windowEnd = date.clone().endOf('day');
        
        const hiresInWindow = timeToHireRaw.filter(hire => {
            const hireDate = moment(hire.metricDate);
            return hireDate.isBetween(windowStart, windowEnd, null, '[]');
        });

        let percentageChange = "0.00";
        
        if (hiresInWindow.length > 0) {
            const avgTimeToHire = hiresInWindow.reduce((sum, h) => sum + h.averageTimeToHire, 0) / hiresInWindow.length;
            percentageChange = computePercentChange(avgTimeToHire, lastKnownValue);
            lastKnownValue = parseFloat(avgTimeToHire.toFixed(2));
        }
        timeToHire.push({
            date: date.format('YYYY-MM-DD'),
            timeToHire: lastKnownValue,
            percentageChange: percentageChange,
        });
    }
    return timeToHire;
}

const computeRollingAverageWithZeros = (startDate: moment.Moment, endDate: moment.Moment, rollingWindowDays: number, metricsRaw: { jobTitle: string, metricDate: string, offerAcceptanceRate: number }[]) => {
    const result = [];
    let lastKnownValue = 0;
    for (let date = startDate.clone(); date.isSameOrBefore(endDate); date.add(1, 'day')) {
        const windowStart = date.clone().subtract(rollingWindowDays - 1, 'days').startOf('day');
        const windowEnd = date.clone().endOf('day');
        
        const metricsInWindow = metricsRaw.filter(metric => {
            const metricDate = moment(metric.metricDate);
            return metricDate.isBetween(windowStart, windowEnd, null, '[]');
        });

        let percentageChange = "0.00";
        
        // Always add data point, even if 0
        if (metricsInWindow.length > 0) {
            const avgRate = metricsInWindow.reduce((sum, m) => sum + (m.offerAcceptanceRate || 0), 0) / metricsInWindow.length;
            percentageChange = computePercentChange(avgRate, lastKnownValue);
            lastKnownValue = parseFloat(avgRate.toFixed(2));
        }
        result.push({
            date: date.format('YYYY-MM-DD'),
            offerAcceptanceRate: lastKnownValue,
            percentageChange: percentageChange,
        });
    }
    return result;
}
