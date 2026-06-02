import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { verifyUserIsMember } from "@/lib/utils/adminAuth";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { DEFAULT_JOB_PIPELINE } from "@/lib/utils/constants";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");
    const email = request.user.email;
    const limit = parseInt(searchParams.get("limit") || "10");
    const page = parseInt(searchParams.get("page") || "1");
    const status = searchParams.get("status");
    const jobOwners = searchParams.get("jobOwners");
    const projectIds = searchParams.get("projectIds");
    const contributors = searchParams.get("contributors");
    const activityStatus = searchParams.get("activityStatus");
    const jobPostType = searchParams.get("jobPostType");
    const careers = searchParams.get("careers");
    const sortBy = searchParams.get("sortBy") || "Position Name (A-Z)";
    const fullReport = searchParams.get("fullReport") === "true";
    const hiringManagers = searchParams.get("hiringManagers");

    const { db } = await connectMongoDB();
    const authResult = await verifyUserIsMember(db, email, orgID);
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.reason }, { status: 403 });
    }

    // Filter careers based on projectId if provided
    let projectCareerIds: string[] | null = null;
    const projectIdsArray = [];
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
                success: false,
                careers: [],
                totalCareers: 0,
            });
        }
    }

    let filter: any = { orgID };
    // if (authUserRole?.role === "hiring_manager" && authUserRole?.careers?.length > 0) {
    //         filter.id = { $in: authUserRole?.careers };
    //     }
    if (careers) {
        filter.id = { $in: careers.split(",") };
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

    if (status && status !== "All Statuses") {
        filter.status = { $in: status.split(",").map((s) => {
            if (s === "Published") {
                return "active";
            } else if (s === "Unpublished") {
                return "inactive";
            } else {
                return s;
            }
        }) };
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

    let sortStage: any = { jobTitleLower: 1 };

    if (sortBy === "Position Name (Z-A)") {
      sortStage = { jobTitleLower: -1 };
    } else if (sortBy === "Project Name (A-Z)") {
      sortStage = { projectSortRank: -1, projectNameLower: 1 };
    } else if (sortBy === "Project Name (Z-A)") {
      sortStage = { projectSortRank: -1, projectNameLower: -1 };
    }

    let paginationStage: any = [
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ];

    if (fullReport) {
      paginationStage = [];
    }

    const recentCareers = await db.collection("careers").aggregate([
        { $match: filter },
        { $lookup: {
            from: "projects",
            let: { careerId: { $toString: "$_id" } },
            pipeline: [
                { $match: { $expr: { $in: ["$$careerId", "$careers"] } } },
                { $project: { _id: 1, name: 1 } },
            ],
            as: "project",
        }},
        { $addFields: {
            projectName: { $ifNull: [{ $arrayElemAt: ["$project.name", 0] }, null] },
            jobTitleLower: { $toLower: "$jobTitle" },
        }},
        { 
          $addFields: {
            projectSortRank: { 
              $cond: {
                if: { $eq: ["$projectName", null] },
                then: 0,
                else: 1,
              },
            },
            projectNameLower: { $toLower: "$projectName" },
          }
        },
        { $sort: sortStage },
        ...paginationStage,
    ], { allowDiskUse: true, maxTimeMS: 30000 }).toArray();

    const interviews = await db.collection("interviews").aggregate([
      { $match: { id: { $in: recentCareers.map((c) => c.id) } } },
    ], { allowDiskUse: true, maxTimeMS: 30000 }).toArray();

    let formattedCareers = [];
    // Map interviews to career stages
    for (const career of recentCareers) {
        const careerInterviews = interviews.filter((i) => i.id === career.id);
        let timelineTemplate = career.pipelineStages || DEFAULT_JOB_PIPELINE;
        timelineTemplate = timelineTemplate.filter((s: any) => s.enabled !== false);
        let newTimelineStages = timelineTemplate.map((stage: any) => ({
            ...stage,
            substages: (stage?.substages || []).map((substage: any) => ({
              ...substage,
              candidates: [],
              droppedCandidates: [],
            })),
        }));
        for (const interview of careerInterviews) {
        const isDropped =
          interview.applicationStatus === "Dropped" ||
          interview.applicationStatus === "Cancelled";


        if (interview.currentStep === "Applied") {
          const currentStage = {
            stage: "CV Screening",
            substage: "Waiting Submission",
          };
          const interviewWithStage = { ...interview, ...currentStage };
            const currentSubstage = newTimelineStages
              .find((stage) => stage.name === currentStage.stage)
              ?.substages.find(
                (substage: any) => substage.name === currentStage.substage
              );
            if (currentSubstage) {
                if (isDropped) {
                    currentSubstage.droppedCandidates.push(interviewWithStage);
                } else {
                    currentSubstage.candidates.push(interviewWithStage);
                }
            }
          continue;
        }

        if (
          interview.currentStep === "AI Interview" ||
          !interview.currentStep ||
          (interview.currentStep === "CV Screening" &&
            interview.status === "For AI Interview")
        ) {
          if (
            interview.status === "For Interview" ||
            interview.status === "For AI Interview"
          ) {
            const currentStage = {
              stage: "AI Interview",
              substage: "Waiting Interview",
            };
            const interviewWithStage = { ...interview, ...currentStage };
            const currentSubstage = newTimelineStages
                .find((stage) => stage.name === currentStage.stage)
                ?.substages.find(
                  (substage: any) => substage.name === currentStage.substage
                )
            if (currentSubstage) {
                if (isDropped) {
                    currentSubstage.droppedCandidates.push(interviewWithStage);
                } else {
                    currentSubstage.candidates.push(interviewWithStage);
                }
            }
            continue;
          }

          const currentSubstage = newTimelineStages
            .find((stage) => stage.name === "AI Interview")
            ?.substages.find(
              (substage: any) => substage.name === "For Review"
            );
          if (currentSubstage) {
            if (isDropped) {
              currentSubstage.droppedCandidates.push({...interview, stage: "AI Interview", substage: "For Review"});
            } else {
              currentSubstage.candidates.push({...interview, stage: "AI Interview", substage: "For Review"});
            }
          }
          continue;
        }

        if (interview.currentStep === "CV Screening") {
          const stage = { stage: "CV Screening", substage: "For Review" };
          const interviewWithStage = { ...interview, ...stage };
            const currentSubstage = newTimelineStages
                .find((stage) => stage.name === "CV Screening")
                ?.substages.find(
                    (substage: any) => substage.name === "For Review"
                )
            if (currentSubstage) {
                if (isDropped) {
                    currentSubstage.droppedCandidates.push(interviewWithStage);
                } else {
                    currentSubstage.candidates.push(interviewWithStage);
                }
            }
          continue;
        }

        if (
          interview.currentStep === "Human Interview" ||
          interview.currentStep === "Job Interview"
        ) {
          if (interview.status === "For Human Interview") {
            const stage = {
              stage: "Human Interview",
              substage: "Waiting Schedule",
            };
            const interviewWithStage = { ...interview, ...stage };
            const currentSubstage = newTimelineStages
                .find((stage) => stage.name === "Human Interview")
                ?.substages.find(
                  (substage: any) => substage.name === "Waiting Schedule"
                )
            if (currentSubstage) {
                if (isDropped) {
                    currentSubstage.droppedCandidates.push(interviewWithStage);
                } else {
                    currentSubstage.candidates.push(interviewWithStage);
                }
            }
            continue;
          }

          if (interview.status === "For Interview") {
            const stage = {
              stage: "Human Interview",
              substage: "Waiting Interview",
            };
            const interviewWithStage = { ...interview, ...stage };
            const currentSubstage = newTimelineStages
                .find((stage) => stage.name === "Human Interview")
                ?.substages.find(
                  (substage: any) => substage.name === "Waiting Interview"
                )
            if (currentSubstage) {
                if (isDropped) {
                    currentSubstage.droppedCandidates.push(interviewWithStage);
                } else {
                    currentSubstage.candidates.push(interviewWithStage);
                }
            }
            continue;
          }

          if (interview.status === "For Human Interview Review") {
            const stage = {
              stage: "Human Interview",
              substage: "For Review",
            };
            const interviewWithStage = { ...interview, ...stage };
            const currentSubstage = newTimelineStages
                .find((stage) => stage.name === "Human Interview")
                ?.substages.find(
                  (substage: any) => substage.name === "For Review"
                )
            if (currentSubstage) {
                if (isDropped) {
                    currentSubstage.droppedCandidates.push(interviewWithStage);
                } else {
                    currentSubstage.candidates.push(interviewWithStage);
                }
            }
            continue;
          }
        }

        if (interview.currentStep === "Job Offered") {
          const currentStage = {
            stage: "Job Offer",
            substage: "For Contract Signing",
          };
          const interviewWithStage = { ...interview, ...currentStage };
          const currentSubstage = newTimelineStages
              .find((stage) => stage.name === currentStage.stage)
              ?.substages.find(
                (substage: any) => substage.name === currentStage.substage
              )
            if (currentSubstage) {
                if (isDropped) {
                    currentSubstage.droppedCandidates.push(interviewWithStage);
                } else {
                    currentSubstage.candidates.push(interviewWithStage);
                }
            }
          continue;
        }

        if (interview.currentStep === "Contract Signed") {
          const currentStage = { stage: "Job Offer", substage: "Hired" };
          const interviewWithStage = { ...interview, ...currentStage };
          const currentSubstage = newTimelineStages
              .find((stage) => stage.name === currentStage.stage)
              ?.substages.find(
                (substage: any) => substage.name === currentStage.substage
              )
            if (currentSubstage) {
                if (isDropped) {
                    currentSubstage.droppedCandidates.push(interviewWithStage);
                } else {
                    currentSubstage.candidates.push(interviewWithStage);
                }
            }
          continue;
        }

        // Custom pipeline stages - use case-insensitive matching
        let pipelineStageStep = newTimelineStages.find(
          (stage) => stage.name && interview.currentStep &&
            stage.name.toLowerCase() === interview.currentStep.toLowerCase()
        );

        // Fallback: Try strict ID matching if name matching failed (handles renamed stages)
        if (!pipelineStageStep && interview.stageId) {
          pipelineStageStep = newTimelineStages.find((stage) => stage.id === interview.stageId);
        }

        if (pipelineStageStep) {
          let substage = pipelineStageStep.substages.find(
            (substage: any) => substage.status && interview.status &&
              substage.status.toLowerCase() === interview.status.toLowerCase()
          );

          // Fallback: Try ID matching for substage
          if (!substage && interview.substageId) {
            substage = pipelineStageStep.substages.find((s: any) => s.id === interview.substageId);
          }

          if (substage) {
            const stage = {
              stage: pipelineStageStep.name, // Use the actual stage name from pipeline
              substage: substage.name,
            };
            const interviewWithStage = { ...interview, ...stage };
            const currentSubstage = newTimelineStages
                .find((stage) => stage.name === pipelineStageStep.name)
                ?.substages.find(
                  (substage: any) => substage.name === stage.substage
                )
            if (currentSubstage) {
                if (isDropped) {
                    currentSubstage.droppedCandidates.push(interviewWithStage);
                } else {
                    currentSubstage.candidates.push(interviewWithStage);
                }
            }
            continue;
          }
        }
        }
        formattedCareers.push({
            ...career,
            timelineStages: newTimelineStages,
        });
    }
    const totalCareers = fullReport ? recentCareers.length : await db.collection("careers").countDocuments({ ...filter });

    return NextResponse.json({ success: true, careers: formattedCareers, totalCareers: totalCareers, });
});