import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import {
    ENHANCED_RESTRICTED_CANDIDATE_ACCESS_ENABLED,
    getAccessibleInterviewEmails,
    getExpandedCandidateAccessIDs,
    getInactiveNoHistoryCandidateEmails,
    shouldIncludeInactiveNoHistoryAccess,
} from "@/lib/utils/permissions/candidateAccess";
import { NextResponse } from "next/server";

interface CandidateFilters {
    skills?: string[];
    locations?: string[];
    currentPositions?: string[];
    minYears?: string;
    maxYears?: string;
    minSalary?: string;
    maxSalary?: string;
    availability?: string[];
    workSetup?: string[];
    preScreening?: {
        questionId: string;
        questionText?: string;
        values: any[];
    }[];
    candidateNames?: string[];
};

export const GET = withAuth(async (request: AuthenticatedRequest) => {
    try {
        const { searchParams } = new URL(request.url);
        const orgID = searchParams.get("orgID");
        const filterStatus = searchParams.get("filterStatus") || "All Application Statuses";
        const sortBy = searchParams.get("sortBy") || "Recent Activity";
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        // Optional payload controls (useful for AI search fetching "all candidates" without huge CV/interview payloads)
        const includeCvData = searchParams.get("includeCvData") !== "0";
        const includeInterviews = searchParams.get("includeInterviews") !== "0";
        const userEmail = request.user?.email;

        // Parse filters
        const filtersParam = searchParams.get("filters");
        let filters: CandidateFilters = {};
        if (filtersParam) {
            try {
              filters = JSON.parse(decodeURIComponent(filtersParam));
            } catch (e) {
              console.error("Error parsing filters:", e);
            }
        }
       
        if (!orgID) {
            return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
        }

        if (!userEmail) {
            return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
        }

        const { db } = await connectMongoDB();
        let careerIDs: string[] = [];
        let hasFullAccess = false;
        const useEnhancedRestrictedAccess = ENHANCED_RESTRICTED_CANDIDATE_ACCESS_ENABLED;
        // Restrict access to candidates based on user's role
        const member = await db.collection("members").findOne({
            email: userEmail,
            orgID: orgID,
        });
        
        if (!member) {
            return NextResponse.json({ error: "User not authorized to access this organization" }, { status: 403 });
        }
        
        hasFullAccess = member.role === "admin" || member.role === "recruiter";
        if (!hasFullAccess) {
            const careers = await db.collection("careers").aggregate([
              {
                $match: {
                  orgID: orgID,
                  "teamMembers.email": userEmail,
                }
              },
              {
                $project: {
                  id: 1,
                }
              }
            ]).toArray();
            const teamCareerIDs = careers.length > 0 ? careers.map((c: any) => c.id) : [];

            careerIDs = [...new Set(teamCareerIDs)];

            if (useEnhancedRestrictedAccess) {
                const assignedCareerIDs = Array.isArray(member?.careers)
                    ? member.careers
                        .map((id: any) => String(id || "").trim())
                        .filter(Boolean)
                    : [];

                careerIDs = [...new Set([
                    ...careerIDs,
                    ...assignedCareerIDs,
                ])];

                const expandedCareerIDs = await getExpandedCandidateAccessIDs(db, orgID, userEmail);
                careerIDs = [...new Set([
                    ...careerIDs,
                    ...expandedCareerIDs,
                ])] as string[];
            }
        }

        const needsSkillsBeforeGroup = (filters.skills?.length ?? 0) > 0 || (filters.candidateNames?.length ?? 0) > 0;
        let skillsPipeline: any[] = needsSkillsBeforeGroup
            ? [
                {
                    $lookup: {
                        from: "org-candidate-skills",
                        let: { email: "$applicantInfo.email" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $and: [
                                        { $eq: ["$candidateEmail", "$$email"] },
                                        { $eq: ["$orgID", orgID] },
                                    ]}
                                }
                            },
                        ],
                        as: "skills"
                    },
                },
                {
                    $unwind: {
                        path: "$skills",
                        preserveNullAndEmptyArrays: true,
                    }
                },
            ]
            : [];
        if (filters.skills?.length > 0) {
            // Apply mongodb atlas search
            skillsPipeline = [
                {
                    $lookup: {
                        from: "org-candidate-skills",
                        let: { email: "$applicantInfo.email" },
                        pipeline: [
                            // Exact match for skillName
                            {
                                $search: {
                                    index: "org_candidate_skills_search",
                                    compound: {
                                        should: filters.skills.map((skill: string) => ({
                                            phrase: {
                                                query: skill,
                                                path: "skillName",
                                            }
                                        })),
                                        minimumShouldMatch: 1,
                                    }
                                }
                            },
                            {
                                $match: {
                                    $expr: { $and: [
                                        { $eq: ["$candidateEmail", "$$email"] },
                                        { $eq: ["$orgID", orgID] },
                                    ]}
                                }
                            },
                        ],
                        as: "skills"
                    },
                },
                {
                    $match: {
                        // Size of skills array must greater than or equal to number of skills in filters
                        $expr: { $gte: [{ $size: "$skills" }, filters.skills.length] },
                    }
                },
                {
                    $unwind: {
                        path: "$skills",
                        preserveNullAndEmptyArrays: false,
                    }
                },
            ]
        }

        const needsCvForSort = sortBy.includes("Name:") || sortBy.includes("Experience:") || 
        sortBy.includes("Current Position:") || sortBy.includes("Location:");
        let locationsPipeline: any[] = needsCvForSort ? [
            {
                $lookup: {
                    from: "applicant-cv",
                    let: { email: "$applicantInfo.email" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$email", "$$email"] },
                                numExperience: { $exists: true, $ne: null },
                            }
                        },
                        {
                          // Convert numExperience to a number, handling arrays and strings
                          $addFields: {
                            expRaw: {
                              $cond: {
                                if: { $isArray: "$numExperience" },
                                then: { $arrayElemAt: ["$numExperience", 0] },
                                else: "$numExperience"
                              }
                            }
                          }
                        },
                        {
                          // Extract numeric value from various formats:
                          // - Number: 5, 5.5
                          // - Pure numeric string: "5", "5.5"
                          // - String with text: "5 years", "5+ years", "5.5 years of experience"
                          $addFields: {
                            expValueStr: { $trim: { input: { $toString: { $ifNull: ["$expRaw", ""] } } } }
                          }
                        },
                        {
                          $addFields: {
                            // Extract first number from the string (handles "5", "5.5", "5 years", "5+ years", etc.)
                            expMatch: {
                              $regexFind: {
                                input: "$expValueStr",
                                regex: "^(\\d+(?:\\.\\d+)?)"
                              }
                            }
                          }
                        },
                        {
                          $addFields: {
                            expValue: {
                              $cond: {
                                if: { $isNumber: "$expRaw" },
                                then: { $toDouble: "$expRaw" },
                                else: {
                                  $cond: {
                                    if: { $ne: ["$expMatch", null] },
                                    then: { $toDouble: "$expMatch.match" },
                                    else: null
                                  }
                                }
                              }
                            }
                          }
                        },
                        {
                          $project: {
                              currentPosition: 1,
                              location: 1,
                              expValue: 1,
                          }
                      }
                    ],
                    as: "applicant-cv"
                },
            },
            {
                $unwind: {
                    path: "$applicant-cv",
                    preserveNullAndEmptyArrays: true,
                }
            }
        ] : [];
        const applicantCVFilters = !!(filters.locations?.length > 0 || filters.currentPositions?.length > 0 || filters.minYears?.length > 0 || filters.maxYears?.length > 0);
        if (applicantCVFilters) {
            const searchConditions = [];

            if (filters.locations?.length > 0) {
                searchConditions.push(...filters.locations.flatMap((location: string) => {
                    return [
                        {
                            autocomplete: {
                                path: "location",
                                query: location,
                            }
                        },
                        {
                            phrase: {
                                query: location,
                                path: "location",
                                score: { boost: { value: 5 } }
                            }
                        }
                    ]
                }));
            }

            if (filters.currentPositions?.length > 0) {
                searchConditions.push(...filters.currentPositions.flatMap((position: string) => {
                    return [
                        {
                            autocomplete: {
                                path: "currentPosition",
                                query: position,
                            }
                        },
                        {
                            phrase: {
                                query: position,
                                path: "currentPosition",
                                score: { boost: { value: 5 } }
                            }
                        }
                    ]
                    
                }));
            }

            locationsPipeline = [
                {
                    $lookup: {
                        from: "applicant-cv",
                        let: { email: "$applicantInfo.email" },
                        pipeline: [
                            ...(searchConditions.length > 0 ? [{
                                $search: {
                                    index: "applicant_cv_search",
                                    compound: {
                                        should: searchConditions,
                                        minimumShouldMatch: 1,
                                    }
                                }
                            }]: []),
                            {
                                $match: {
                                    $expr: { $eq: ["$email", "$$email"] },
                                    ...(filters.minYears || filters.maxYears ? { numExperience: { $exists: true, $ne: null } } : []),
                                }
                            },
                            ...(filters.minYears || filters.maxYears  ? getExperiencePipeline(filters.minYears, filters.maxYears) : []),
                            ...(searchConditions.length > 0 ? [
                              {
                                $addFields: {
                                    score: { $meta: "searchScore" }
                                }
                            },
                            {
                                $match: {
                                    score: { $gte: 2 }
                                }
                            }] : []),
                            {
                                $project: {
                                    currentPosition: 1,
                                    location: 1,
                                    expValue: 1
                                }
                            }
                        ],
                        as: "applicant-cv"
                    },
                },
                {
                    $unwind: {
                        path: "$applicant-cv",
                        preserveNullAndEmptyArrays: false,
                    }
                }
            ]
        }

        let preScreeningPipeline: any = {
            $and: []
        }
        if (filters.preScreening?.length > 0) {
            for (const preScreeningFilter of filters.preScreening) {
                const { questionId, values, questionText } = preScreeningFilter;
                // Range question
                const valueObject = values?.[0];
                const isRange = valueObject && typeof valueObject === "object" && (valueObject.min != null || valueObject.max != null);
                if (isRange) {
                    const filterMin = isNaN(Number(valueObject.min)) ? null : Number(valueObject.min);
                    const filterMax = isNaN(Number(valueObject.max)) ? null : Number(valueObject.max);
                    const rangeCondition = {
                        $and: []
                    }
                    if (filterMin != null) {
                        rangeCondition.$and.push({
                            $and: [
                                { "id": questionId },
                                { "selectedAnswers.type": "Minimum" },
                                { "selectedAnswers.value": { $gte: filterMin } },
                            ]
                        })
                    }

                    if (filterMax != null) {
                        rangeCondition.$and.push(                              {
                            $and: [
                                { "id": questionId },
                                { "selectedAnswers.type": "Maximum" },
                                { "selectedAnswers.value": { $lte: filterMax } },
                            ]
                        })
                    }
                    if (rangeCondition.$and.length > 0) {
                        preScreeningPipeline.$and.push(rangeCondition);
                    }
                } else if (questionText && values?.length > 0) {
                  const desiredAnswers = values?.map((v: any) => v.trim());
                  preScreeningPipeline.$and.push(...[
                      { "question": { $regex: questionText, $options: "i" } },
                      { "selectedAnswers.value": { $in: desiredAnswers } },
                  ]);
                }
            }
        }

        let candidateNamesMatchPipeline: any[] = [];
        if (filters.candidateNames?.length > 0) {
            const escaped = filters.candidateNames.map((s: string) =>
                String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            );
            const regexPattern = escaped.join("|");
            candidateNamesMatchPipeline = [
                {
                    $match: {
                        $or: [
                            { "applicantInfo.name": { $regex: regexPattern, $options: "i" } },
                            { "applicantInfo.email": { $regex: regexPattern, $options: "i" } },
                            { "applicant-cv.currentPosition": { $regex: regexPattern, $options: "i" } },
                            { "skills.skillName": { $regex: regexPattern, $options: "i" } },
                        ],
                    },
                },
            ];
        }
        const hasPreScreeningFilters = preScreeningPipeline.$and.length > 0;
        const shouldIncludeInactiveNoHistory =
            !hasFullAccess && shouldIncludeInactiveNoHistoryAccess(filterStatus, hasPreScreeningFilters);

        const restrictedCareerExprConditions =
            !hasFullAccess && careerIDs.length > 0
                ? useEnhancedRestrictedAccess
                    ? [{
                        $or: [
                            { $in: [{ $ifNull: [{ $toString: "$id" }, ""] }, careerIDs] },
                            { $in: [{ $ifNull: [{ $toString: "$careerID" }, ""] }, careerIDs] },
                            { $in: [{ $ifNull: [{ $toString: "$careerId" }, ""] }, careerIDs] }
                        ]
                    }]
                    : [{ $in: [ "$id", careerIDs ] }]
                : [];

        let restrictedAllowedEmails: string[] | null = null;
        if (!hasFullAccess) {
            if (useEnhancedRestrictedAccess && careerIDs.length === 0 && !shouldIncludeInactiveNoHistory) {
                return NextResponse.json({
                    candidates: [],
                    totalCount: 0,
                });
            }

            if (shouldIncludeInactiveNoHistory) {
                const [accessibleInterviewEmails, inactiveNoHistoryEmails] = await Promise.all([
                    getAccessibleInterviewEmails(db, orgID, careerIDs),
                    getInactiveNoHistoryCandidateEmails(db, orgID),
                ]);

                restrictedAllowedEmails = [...new Set([
                    ...accessibleInterviewEmails,
                    ...inactiveNoHistoryEmails,
                ])];

                if (restrictedAllowedEmails.length === 0) {
                    return NextResponse.json({
                        candidates: [],
                        totalCount: 0,
                    });
                }
            }
        }

        const shouldRequireInterviewMatch =
            filterStatus !== "All Application Statuses" ||
            hasPreScreeningFilters ||
            (!hasFullAccess && careerIDs.length > 0 && !shouldIncludeInactiveNoHistory);

        const orgCandidateEmails = await db.collection("affiliations").aggregate([
            {
                $match: {
                    orgID: orgID,
                    ...(restrictedAllowedEmails
                        ? { "applicantInfo.email": { $in: restrictedAllowedEmails } }
                        : {}),
                }
            },
            {
                $lookup: {
                    from: "interviews",
                    let: { email: "$applicantInfo.email" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { 
                                    $and: [
                                    { $eq: ["$email", "$$email"] },
                                    { $eq: ["$orgID", orgID] },
                                    ...(filterStatus !== "All Application Statuses" ? [{ applicationStatus: filterStatus }] : []),
                                    ...restrictedCareerExprConditions
                                ]},
                                ...(hasPreScreeningFilters ? {
                                    preScreeningQuestions: {
                                        $elemMatch: {
                                            $and: preScreeningPipeline.$and
                                        }
                                    }
                                } : []),
                            },
                        },
                        { $sort: { updatedAt: -1 } },
                        { $limit: 1 },
                        {
                            $project: {
                                _id: 1,
                                updatedAt: 1,
                                email: 1,
                            }
                        }
                    ],
                    as: "interviews"
                }
            },
            ...(shouldRequireInterviewMatch ? [{
              $match: {
                // non-empty interviews array
                $expr: { $gt: [{ $size: "$interviews" }, 0] }
              }
            }] : []),
            ...skillsPipeline,
            ...locationsPipeline,
            ...candidateNamesMatchPipeline,
            {
                $group: {
                    _id: {
                        email: "$applicantInfo.email",
                        name: "$applicantInfo.name",
                    },
                    createdAt: { $min: "$createdAt" },
                    latestInterview: { $addToSet: "$interviews" },
                    ...(needsCvForSort || applicantCVFilters ? {
                        applicantCv: { $addToSet: "$applicant-cv" },
                    } : {}),
                }
            },
            ...(needsCvForSort || applicantCVFilters ? [{
                $addFields: {
                        currentPosition: { $ifNull: [{ $arrayElemAt: ["$applicantCv.currentPosition", 0] }, ""] },
                        location: { $ifNull: [{ $arrayElemAt: ["$applicantCv.location", 0] }, ""] },
                        experienceYears: { $ifNull: [{ $arrayElemAt: ["$applicantCv.expValue", 0] }, null] },
                    }
            }] : []),
            {
                $addFields: {
                    activeAt: { $ifNull: [{ $arrayElemAt: ["$latestInterview.updatedAt", 0] }, "$createdAt"] },
                    name: "$_id.name",
                },
            },
            {
                $facet: {
                    count: [{ $count: "count" }],
                    candidateEmails: [
                        { $sort: getSortStage(sortBy) },
                        { $skip: (page - 1) * limit },
                        { $limit: limit },
                    ]
                }
            }
        ], { allowDiskUse: true, maxTimeMS: 30000 }).toArray();

        const filteredEmails = orgCandidateEmails?.[0]?.candidateEmails?.map((e: any) => e._id.email) || [];
        if (filteredEmails.length > 0) {
            const candidates = await db.collection("affiliations").aggregate([
                {
                    $match: {
                        orgID: orgID,
                        "applicantInfo.email": { $in: filteredEmails }
                    }
                },
                {
                    $lookup: {
                      from: "interviews",
                      let: { email: "$applicantInfo.email" },
                      pipeline: [
                        {
                          $match: {
                            $expr: {
                              $and: [
                                { $eq: ["$email", "$$email"] },
                                { $eq: ["$orgID", orgID] },
                                ...(filterStatus !== "All Application Statuses" ? [{ applicationStatus: filterStatus }] : []),
                                ...restrictedCareerExprConditions
                              ]
                            }
                          }
                        },
                        { $project: { _id: 1, applicationStatus: 1, updatedAt: 1 } }
                      ],
                      as: "interviews"
                    }
                  },
                  { $unwind: { path: "$interviews", preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: "recruiter-evaluations",
                        let: {
                        interviewUID: { $toString: "$interviews._id" },
                        status: {
                            $cond: {
                            if: { $ne: ["$interviews.applicationStatus", "Dropped"] },
                            then: "Endorsed",
                            else: "Dropped"
                            }
                        }
                        },
                        pipeline: [{
                        $match: {
                            $expr: { $and: [
                            { $eq: ["$interviewUID", "$$interviewUID"] },
                            { $eq: ["$action", "$$status"] }
                            ]}
                        }
                        }, { $sort: { createdAt: -1 } }, { $limit: 1 }],
                        as: "evaluations"
                    }
                    },
                    {
                        $addFields: {
                            "interviews.currentEvaluation": { $arrayElemAt: ["$evaluations", 0] },
                            importDate: "$createdAt",
                            affiliationId: { $toString: "$_id" }
                        }
                    },
                    {
                        $group: {
                          _id: {
                            email: "$applicantInfo.email",
                            name: "$applicantInfo.name",
                            image: "$applicantInfo.image",
                            accountStatus: "$status",
                            importDate: "$importDate",
                            affiliationId: "$affiliationId"
                          },
                          interviews: { $push: "$interviews" }
                        }
                      },
                      {
                        $lookup: {
                          from: "applicant-cv",
                          localField: "_id.email",
                          foreignField: "email",
                          pipeline: [{
                            $project: {
                              _id: 0,
                              ...(includeCvData ? { digitalCV: 1 } : {}),
                              availability: 1,
                              availableFrom: 1,
                              preferredWorkSetup: 1,
                              workSetup: 1,
                              askingSalary: 1,
                              salary: 1,
                              expectedSalary: 1,
                              location: 1,
                              currentPosition: 1,
                              numExperience: 1
                            }
                          }],
                          as: "cvData"
                        }
                      },
                      {
                        $lookup: {
                          from: "org-candidate-skills",
                          let: { email: "$_id.email" },
                          pipeline: [{
                            $match: {
                              $expr: { $and: [
                                { $eq: ["$candidateEmail", "$$email"] },
                                { $eq: ["$orgID", orgID] }
                              ]}
                            }
                          }, {
                            $project: { _id: 0, skillName: 1, source: 1 }
                          }, {
                            $sort: { skillName: 1 }
                          }],
                          as: "skillsMetadata"
                        }
                      },
                      {
                        $addFields: {
                          cvData: { $arrayElemAt: ["$cvData.digitalCV", 0] },
                          cvInfo: { $arrayElemAt: ["$cvData", 0] },
                          skills: {
                            $map: {
                              input: "$skillsMetadata",
                              as: "skill",
                              in: "$$skill.skillName"
                            }
                          },
                        }
                      },
                      {
                        $addFields: {
                          availability: "$cvInfo.availability",
                          availableFrom: "$cvInfo.availableFrom",
                          preferredWorkSetup: "$cvInfo.preferredWorkSetup",
                          workSetup: "$cvInfo.workSetup",
                          askingSalary: "$cvInfo.askingSalary",
                          salary: "$cvInfo.salary",
                          expectedSalary: "$cvInfo.expectedSalary",
                          currentPosition: { $ifNull: ["$cvInfo.currentPosition", ""] },
                          location: { $ifNull: ["$cvInfo.location", ""] },
                          experienceYears: {
                            $cond: {
                              if: { $eq: ["$cvInfo.numExperience", null] },
                              then: null,
                              else: {
                                $cond: {
                                  if: { $eq: [{ $type: "$cvInfo.numExperience" }, "string"] },
                                  then: {
                                    $let: {
                                      vars: {
                                        match: {
                                          $regexFind: {
                                            input: "$cvInfo.numExperience",
                                            regex: "^(\\d+(?:\\.\\d+)?)"
                                          }
                                        }
                                      },
                                      in: {
                                        $cond: {
                                          if: { $ne: ["$$match", null] },
                                          then: { $toDouble: "$$match.match" },
                                          else: null
                                        }
                                      }
                                    }
                                  },
                                  else: { $toDouble: "$cvInfo.numExperience" }
                                }
                              }
                            }
                          },
                          candidateStatus: {
                            $switch: {
                              branches: [
                                {
                                  case: {
                                    $eq: [{
                                      $size: {
                                        $filter: {
                                          input: "$interviews",
                                          as: "i",
                                          cond: { $eq: ["$$i", {}] }
                                        }
                                      }
                                    }, { $size: "$interviews" }]
                                  },
                                  then: "Inactive"
                                },
                                {
                                  case: {
                                    $gt: [{
                                      $size: {
                                        $filter: {
                                          input: "$interviews",
                                          as: "i",
                                          cond: {
                                            $or: [
                                              { $in: ["$$i.applicationStatus", ["Ongoing", null]] },
                                              { $eq: [{ $type: "$$i.applicationStatus" }, "missing"] }
                                            ]
                                          }
                                        }
                                      }
                                    }, 0]
                                  },
                                  then: "Ongoing"
                                }
                              ],
                              default: { $arrayElemAt: ["$interviews.applicationStatus", 0] }
                            }
                          },
                          activeAt: {
                            $toDate: {
                              $ifNull: [
                                { $arrayElemAt: ["$interviews.updatedAt", 0] },
                                "$_id.importDate"
                              ]
                            }
                          }
                        }
                      },
                      { $addFields: { "order": { $indexOfArray: [ filteredEmails, "$_id.email" ] } } },
                      {
                        $project: {
                            _id: 0,
                            email: "$_id.email",
                            name: "$_id.name",
                            image: "$_id.image",
                            affiliationId: "$_id.affiliationId",
                            candidateStatus: 1,
                            activeAt: 1,
                            skills: 1,
                            availability: 1,
                            availableFrom: 1,
                            preferredWorkSetup: 1,
                            workSetup: 1,
                            askingSalary: 1,
                            salary: 1,
                            expectedSalary: 1,
                            currentPosition: 1,
                            location: 1,
                            experienceYears: 1,
                            ...(includeInterviews ? { interviews: 1 } : {}),
                            ...(includeCvData ? { cvData: 1 } : {}),
                            order: 1,
                          }
                      },
                      { $sort: { order: 1 } }
            ], { allowDiskUse: true, maxTimeMS: 30000 }).toArray();
            
            return NextResponse.json({
                candidates: candidates,
                totalCount: orgCandidateEmails?.[0]?.count?.[0]?.count || 0,
            })
        }

        return NextResponse.json({
            candidates: [],
            totalCount: 0,
        })
    } catch (error) {
        console.error("Error fetching candidates:", error);
        return NextResponse.json(
            { error: "Failed to fetch candidates", details: error.message },
            { status: 500 }
        );
    }
});

const getSortStage = (sortBy: string) => {
    switch (sortBy) {
        case "Name: A-Z":
            return { name: 1 };
        case "Name: Z-A":
            return { name: -1 };
        case "Experience: Low to High":
            return { experienceYears: 1 };
        case "Experience: High to Low":
            return { experienceYears: -1 };
        case "Current Position: A-Z":
            return { currentPosition: 1 };
        case "Current Position: Z-A":
            return { currentPosition: -1 };
        case "Location: A-Z":
            return { location: 1 };
        case "Location: Z-A":
            return { location: -1 };
        case "Last Active: Newest":
            return { activeAt: -1 };
        case "Last Active: Oldest":
            return { activeAt: 1 };
        default:
            return { activeAt: -1 };
    }
}

const getExperiencePipeline = (minYears: string, maxYears: string) => {
    const minYearsNum = minYears ? parseFloat(minYears) : null;
    const maxYearsNum = maxYears ? parseFloat(maxYears) : null;

    let matchPipeline: any[] = [];
    if (minYears && !maxYears) {
      matchPipeline.push({
        $match: {
          $expr: {
            $gte: ["$expValue", minYearsNum]
          }
        }
      });
    }
    if (maxYears && !minYears) {
      matchPipeline.push({
        $match: {
          $expr: {
            $lte: ["$expValue", maxYearsNum]
          }
        }
      });
    }
    if (minYears && maxYears) {
      matchPipeline.push({
        $match: {
          $expr: {
            $and: [
              { $gte: ["$expValue", minYearsNum] },
              { $lte: ["$expValue", maxYearsNum] }
            ]
          }
        }
      });
    }
    
    // Simple aggregation: extract numeric experience value and filter
    return [
      {
        // Convert numExperience to a number, handling arrays and strings
        $addFields: {
          expRaw: {
            $cond: {
              if: { $isArray: "$numExperience" },
              then: { $arrayElemAt: ["$numExperience", 0] },
              else: "$numExperience"
            }
          }
        }
      },
      {
        // Extract numeric value from various formats:
        // - Number: 5, 5.5
        // - Pure numeric string: "5", "5.5"
        // - String with text: "5 years", "5+ years", "5.5 years of experience"
        $addFields: {
          expValueStr: { $trim: { input: { $toString: { $ifNull: ["$expRaw", ""] } } } }
        }
      },
      {
        $addFields: {
          // Extract first number from the string (handles "5", "5.5", "5 years", "5+ years", etc.)
          expMatch: {
            $regexFind: {
              input: "$expValueStr",
              regex: "^(\\d+(?:\\.\\d+)?)"
            }
          }
        }
      },
      {
        $addFields: {
          expValue: {
            $cond: {
              if: { $isNumber: "$expRaw" },
              then: { $toDouble: "$expRaw" },
              else: {
                $cond: {
                  if: { $ne: ["$expMatch", null] },
                  then: { $toDouble: "$expMatch.match" },
                  else: null
                }
              }
            }
          }
        }
      },
      {
        // Filter: expValue must be a valid number
        $match: {
          expValue: { $ne: null, $type: "number" }
        }
      },
      ...matchPipeline,
    ];
}
