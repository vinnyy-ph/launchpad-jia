import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { cache } from "@/lib/utils/cache";

/**
 * OPTIMIZED VERSION: Two-phase approach
 * Phase 1: Get candidate emails with minimal data (fast)
 * Phase 2: Fetch full details only for the 20 candidates we need
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");
    const filterStatus = searchParams.get("filterStatus");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Parse filter parameters
    const filtersParam = searchParams.get("filters");
    let filters: any = {};
    if (filtersParam) {
      try {
        filters = JSON.parse(decodeURIComponent(filtersParam));
      } catch (e) {
        console.error("Error parsing filters:", e);
      }
    }
    
    // Extract filter values
    const skills = filters.skills || [];
    const locations = filters.locations || [];
    const currentPositions = filters.currentPositions || [];
    const candidateNames = filters.candidateNames || [];
    const minYears = filters.minYears ? parseFloat(filters.minYears) : null;
    const maxYears = filters.maxYears ? parseFloat(filters.maxYears) : null;
    const minSalary = filters.minSalary ? parseFloat(filters.minSalary) : null;
    const maxSalary = filters.maxSalary ? parseFloat(filters.maxSalary) : null;
    const availability = filters.availability || [];
    const workSetup = filters.workSetup || [];
    const preScreeningFilters = filters.preScreening || [];

    if (!orgID) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    
    // Get user's email from authenticated request
    const userEmail = request.user?.email;
    
    // Get all career IDs where the user is a team member
    let userCareerIDs: string[] = [];
    if (userEmail) {
      const userCareers = await db
        .collection("careers")
        .find(
          {
            orgID: orgID,
            "teamMembers.email": userEmail,
          },
          {
            projection: {
              _id: 1,
              id: 1,
            },
            limit: 1000,
          }
        )
        .toArray();
      
      userCareerIDs = userCareers.flatMap((career: any) => {
        const ids: string[] = [];
        if (career._id) ids.push(career._id.toString());
        if (career.id) ids.push(career.id.toString());
        return ids;
      });
      userCareerIDs = [...new Set(userCareerIDs)];
    }
    
    let searchFilter = {};
    if (search) {
      searchFilter = {
        $or: [
          { "applicantInfo.email": { $regex: search, $options: "i" } },
          { "applicantInfo.name": { $regex: search, $options: "i" } },
        ],
      };
    }

    // Build sort object
    let sortField = "activeAt";
    let sortDirection = -1;
    
    if (sortBy === "Recent Activity") {
      sortField = "activeAt";
      sortDirection = -1;
    } else if (sortBy === "Oldest Activity" || sortBy === "Last Active: Oldest") {
      sortField = "activeAt";
      sortDirection = 1;
    } else if (sortBy === "Last Active: Newest") {
      sortField = "activeAt";
      sortDirection = -1;
    } else if (sortBy === "Name: A-Z" || sortBy === "Alphabetical (A-Z)") {
      sortField = "name";
      sortDirection = 1;
    } else if (sortBy === "Name: Z-A" || sortBy === "Alphabetical (Z-A)") {
      sortField = "name";
      sortDirection = -1;
    } else if (sortBy === "Experience: Low to High") {
      sortField = "experienceYears";
      sortDirection = 1;
    } else if (sortBy === "Experience: High to Low") {
      sortField = "experienceYears";
      sortDirection = -1;
    } else if (sortBy === "Current Position: A-Z") {
      sortField = "currentPosition";
      sortDirection = 1;
    } else if (sortBy === "Current Position: Z-A") {
      sortField = "currentPosition";
      sortDirection = -1;
    } else if (sortBy === "Location: A-Z") {
      sortField = "location";
      sortDirection = 1;
    } else if (sortBy === "Location: Z-A") {
      sortField = "location";
      sortDirection = -1;
    }
    
    const sort: any = { [sortField]: sortDirection };

    // Generate cache key
    const cacheKey = cache.generateKey("candidates", {
      orgID,
      filterStatus,
      search,
      sortBy,
      page,
      limit,
      filters: filtersParam,
      userEmail,
    });

    // Check cache first (only for non-first page)
    if (page > 1) {
      const cached = cache.get<any>(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    // PHASE 1: Get candidate emails with minimal processing (FAST)
    // This phase only groups candidates and calculates basic fields needed for sorting/filtering
    const candidateEmailsPipeline: any[] = [
      {
        $match: {
          orgID: orgID,
          ...searchFilter,
        },
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
                  ],
                },
                ...(userEmail && userCareerIDs.length > 0
                  ? {
                      $or: [
                        { id: { $in: userCareerIDs } },
                        { careerID: { $in: userCareerIDs } },
                        { careerId: { $in: userCareerIDs } },
                      ],
                    }
                  : {}),
                ...(filterStatus && filterStatus !== "All Application Statuses"
                  ? { applicationStatus: filterStatus }
                  : {}),
              },
            },
            // Only fetch minimal fields needed for filtering/sorting
            {
              $project: {
                _id: 1,
                applicationStatus: 1,
                updatedAt: 1,
                id: 1,
                careerID: 1,
                careerId: 1,
                preScreeningQuestions: 1,
              },
            },
          ],
          as: "interviews",
        },
      },
      {
        $group: {
          _id: {
            email: "$applicantInfo.email",
            name: "$applicantInfo.name",
            image: "$applicantInfo.image",
            importDate: "$createdAt",
          },
          interviews: { $push: { $arrayElemAt: ["$interviews", 0] } }, // Simplified
        },
      },
      // Filter out candidates with no valid interviews (if user has career restrictions)
      ...(userEmail && userCareerIDs.length > 0
        ? [
            {
              $match: {
                $expr: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$interviews",
                          as: "i",
                          cond: {
                            $and: [
                              { $ne: ["$$i", null] },
                              {
                                $or: [
                                  { $in: [{ $toString: "$$i.id" }, userCareerIDs] },
                                  { $in: [{ $toString: "$$i.careerID" }, userCareerIDs] },
                                  { $in: [{ $toString: "$$i.careerId" }, userCareerIDs] },
                                ],
                              },
                            ],
                          },
                        },
                      },
                    },
                    0,
                  ],
                },
              },
            },
          ]
        : []),
      // Add basic computed fields for sorting
      {
        $addFields: {
          candidateStatus: {
            $switch: {
              branches: [
                {
                  case: {
                    $eq: [
                      {
                        $size: {
                          $filter: {
                            input: "$interviews",
                            as: "i",
                            cond: { $eq: ["$$i", null] },
                          },
                        },
                      },
                      { $size: "$interviews" },
                    ],
                  },
                  then: "Inactive",
                },
                {
                  case: {
                    $gt: [
                      {
                        $size: {
                          $filter: {
                            input: "$interviews",
                            as: "i",
                            cond: {
                              $or: [
                                { $in: ["$$i.applicationStatus", ["Ongoing", null]] },
                                { $eq: [{ $type: "$$i.applicationStatus" }, "missing"] },
                              ],
                            },
                          },
                        },
                      },
                      0,
                    ],
                  },
                  then: "Ongoing",
                },
              ],
              default: { $arrayElemAt: ["$interviews.applicationStatus", 0] },
            },
          },
          activeAt: {
            $toDate: {
              $ifNull: [
                { $arrayElemAt: ["$interviews.updatedAt", 0] },
                "$_id.importDate",
              ],
            },
          },
        },
      },
      // Filter by status if needed
      ...(filterStatus && filterStatus !== "All Application Statuses"
        ? [
            {
              $match: {
                $or: [
                  { "interviews.applicationStatus": filterStatus },
                  { candidateStatus: filterStatus },
                ],
              },
            },
          ]
        : []),
      // Lookup CV data early (only basic fields needed for filtering)
      {
        $lookup: {
          from: "applicant-cv",
          localField: "_id.email",
          foreignField: "email",
          pipeline: [
            {
              $project: {
                _id: 0,
                location: 1,
                currentPosition: 1,
                numExperience: 1,
                availability: 1,
                workSetup: 1,
                preferredWorkSetup: 1,
                askingSalary: 1,
                salary: 1,
                expectedSalary: 1,
              },
            },
          ],
          as: "cvInfo",
        },
      },
      {
        $addFields: {
          cvInfo: { $arrayElemAt: ["$cvInfo", 0] },
        },
      },
      {
        $addFields: {
          location: { $ifNull: ["$cvInfo.location", ""] },
          currentPosition: { $ifNull: ["$cvInfo.currentPosition", ""] },
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
          availability: "$cvInfo.availability",
          workSetup: "$cvInfo.workSetup",
          preferredWorkSetup: "$cvInfo.preferredWorkSetup",
          askingSalary: "$cvInfo.askingSalary",
          salary: "$cvInfo.salary",
          expectedSalary: "$cvInfo.expectedSalary",
        },
      },
      // Apply filters early (before pagination, but after we have the data needed)
      ...(skills.length > 0 || locations.length > 0 || currentPositions.length > 0 ||
          candidateNames.length > 0 || minYears !== null || maxYears !== null ||
          minSalary !== null || maxSalary !== null || availability.length > 0 ||
          workSetup.length > 0 || preScreeningFilters.length > 0
        ? [
            {
              $lookup: {
                from: "org-candidate-skills",
                let: { candidateEmail: "$_id.email" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$candidateEmail", "$$candidateEmail"] },
                          { $eq: ["$orgID", orgID] },
                        ],
                      },
                    },
                  },
                  { $project: { _id: 0, skillName: 1 } },
                ],
                as: "skillsMetadata",
              },
            },
            {
              $addFields: {
                skills: {
                  $map: {
                    input: "$skillsMetadata",
                    as: "skill",
                    in: "$$skill.skillName",
                  },
                },
              },
            },
            {
              $match: {
                $and: [
                  // Skills filter
                  ...(skills.length > 0
                    ? [
                        {
                          $expr: {
                            $anyElementTrue: {
                              $map: {
                                input: "$skills",
                                as: "skill",
                                in: {
                                  $anyElementTrue: {
                                    $map: {
                                      input: skills,
                                      as: "filterSkill",
                                      in: {
                                        $eq: [
                                          { $toLower: "$$skill" },
                                          { $toLower: "$$filterSkill" },
                                        ],
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      ]
                    : []),
                  // Location filter
                  ...(locations.length > 0
                    ? [
                        {
                          $or: locations.map((loc: string) => ({
                            location: { $regex: loc, $options: "i" },
                          })),
                        },
                      ]
                    : []),
                  // Current Position filter
                  ...(currentPositions.length > 0
                    ? [
                        {
                          $or: currentPositions.map((pos: string) => ({
                            currentPosition: { $regex: pos, $options: "i" },
                          })),
                        },
                      ]
                    : []),
                  // Candidate name filter
                  ...(candidateNames.length > 0
                    ? [
                        {
                          $or: [
                            ...candidateNames.map((name: string) => ({
                              name: { $regex: name, $options: "i" },
                            })),
                            ...candidateNames.map((name: string) => ({
                              email: { $regex: name, $options: "i" },
                            })),
                          ],
                        },
                      ]
                    : []),
                  // Experience filter
                  ...(minYears !== null || maxYears !== null
                    ? [
                        {
                          $expr: {
                            $and: [
                              ...(minYears !== null
                                ? [{ $gte: ["$experienceYears", minYears] }]
                                : []),
                              ...(maxYears !== null
                                ? [{ $lte: ["$experienceYears", maxYears] }]
                                : []),
                            ],
                          },
                        },
                      ]
                    : []),
                  // Salary filter (simplified - check CV fields only for speed)
                  ...(minSalary !== null || maxSalary !== null
                    ? [
                        {
                          $or: [
                            ...(minSalary !== null
                              ? [
                                  { askingSalary: { $gte: minSalary } },
                                  { salary: { $gte: minSalary } },
                                  { expectedSalary: { $gte: minSalary } },
                                ]
                              : []),
                            ...(maxSalary !== null
                              ? [
                                  { askingSalary: { $lte: maxSalary } },
                                  { salary: { $lte: maxSalary } },
                                  { expectedSalary: { $lte: maxSalary } },
                                ]
                              : []),
                          ],
                        },
                      ]
                    : []),
                  // Availability filter
                  ...(availability.length > 0
                    ? [
                        {
                          $or: availability.map((avail: string) => ({
                            availability: { $regex: avail, $options: "i" },
                          })),
                        },
                      ]
                    : []),
                  // Work Setup filter
                  ...(workSetup.length > 0
                    ? [
                        {
                          $or: [
                            ...workSetup.map((ws: string) => ({
                              preferredWorkSetup: {
                                $regex: ws.replace(/\s+/g, "").replace(/-/g, ""),
                                $options: "i",
                              },
                            })),
                            ...workSetup.map((ws: string) => ({
                              workSetup: {
                                $regex: ws.replace(/\s+/g, "").replace(/-/g, ""),
                                $options: "i",
                              },
                            })),
                          ],
                        },
                      ]
                    : []),
                ],
              },
            },
          ]
        : []),
      // Get total count BEFORE pagination
      {
        $facet: {
          metadata: [{ $count: "totalCount" }],
          candidateEmails: [
            { $sort: sort },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                email: "$_id.email",
                name: "$_id.name",
                image: "$_id.image",
              },
            },
          ],
        },
      },
    ];

    const phase1Result = await db
      .collection("affiliations")
      .aggregate(candidateEmailsPipeline, {
        allowDiskUse: true,
        maxTimeMS: 30000,
      })
      .toArray();

    const totalCount =
      phase1Result[0]?.metadata?.[0]?.totalCount || 0;
    const candidateEmails = phase1Result[0]?.candidateEmails || [];

    if (candidateEmails.length === 0) {
      return NextResponse.json({
        candidates: [],
        totalCount: 0,
      });
    }

    const emails = candidateEmails.map((c: any) => c.email);

    // PHASE 2: Fetch full details ONLY for the 20 candidates we need (FAST)
    const fullDetailsPipeline: any[] = [
      {
        $match: {
          orgID: orgID,
          "applicantInfo.email": { $in: emails },
        },
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
                  ],
                },
                ...(userEmail && userCareerIDs.length > 0
                  ? {
                      $or: [
                        { id: { $in: userCareerIDs } },
                        { careerID: { $in: userCareerIDs } },
                        { careerId: { $in: userCareerIDs } },
                      ],
                    }
                  : {}),
                ...(filterStatus && filterStatus !== "All Application Statuses"
                  ? { applicationStatus: filterStatus }
                  : {}),
              },
            },
          ],
          as: "interviews",
        },
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
                else: "Dropped",
              },
            },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$interviewUID", "$$interviewUID"] },
                    { $eq: ["$action", "$$status"] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "evaluations",
        },
      },
      {
        $addFields: {
          "interviews.currentEvaluation": {
            $arrayElemAt: ["$evaluations", 0],
          },
          importDate: "$createdAt",
        },
      },
      {
        $group: {
          _id: {
            email: "$applicantInfo.email",
            name: "$applicantInfo.name",
            accountStatus: "$status",
            importDate: "$importDate",
            image: "$applicantInfo.image",
          },
          interviews: { $push: "$interviews" },
        },
      },
      {
        $lookup: {
          from: "applicant-cv",
          localField: "_id.email",
          foreignField: "email",
          pipeline: [
            {
              $project: {
                _id: 0,
                digitalCV: 1,
                availability: 1,
                availableFrom: 1,
                preferredWorkSetup: 1,
                workSetup: 1,
                askingSalary: 1,
                salary: 1,
                expectedSalary: 1,
                location: 1,
                currentPosition: 1,
                numExperience: 1,
              },
            },
          ],
          as: "cvData",
        },
      },
      {
        $lookup: {
          from: "org-candidate-skills",
          let: { candidateEmail: "$_id.email" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$candidateEmail", "$$candidateEmail"] },
                    { $eq: ["$orgID", orgID] },
                  ],
                },
              },
            },
            { $project: { _id: 0, skillName: 1, source: 1 } },
            { $sort: { skillName: 1 } },
          ],
          as: "skillsMetadata",
        },
      },
      {
        $addFields: {
          cvData: { $arrayElemAt: ["$cvData.digitalCV", 0] },
          cvInfo: { $arrayElemAt: ["$cvData", 0] },
          skills: {
            $map: {
              input: "$skillsMetadata",
              as: "skill",
              in: "$$skill.skillName",
            },
          },
        },
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
                    $eq: [
                      {
                        $size: {
                          $filter: {
                            input: "$interviews",
                            as: "i",
                            cond: { $eq: ["$$i", {}] },
                          },
                        },
                      },
                      { $size: "$interviews" },
                    ],
                  },
                  then: "Inactive",
                },
                {
                  case: {
                    $gt: [
                      {
                        $size: {
                          $filter: {
                            input: "$interviews",
                            as: "i",
                            cond: {
                              $or: [
                                { $in: ["$$i.applicationStatus", ["Ongoing", null]] },
                                { $eq: [{ $type: "$$i.applicationStatus" }, "missing"] },
                              ],
                            },
                          },
                        },
                      },
                      0,
                    ],
                  },
                  then: "Ongoing",
                },
              ],
              default: { $arrayElemAt: ["$interviews.applicationStatus", 0] },
            },
          },
          activeAt: {
            $toDate: {
              $ifNull: [
                { $arrayElemAt: ["$interviews.updatedAt", 0] },
                "$_id.importDate",
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          email: "$_id.email",
          name: "$_id.name",
          image: "$_id.image",
          interviews: 1,
          candidateStatus: 1,
          activeAt: 1,
          cvData: 1,
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
        },
      },
      // Sort to match the order from phase 1
      { $sort: sort },
    ];

    const fullCandidates = await db
      .collection("affiliations")
      .aggregate(fullDetailsPipeline, {
        allowDiskUse: true,
        maxTimeMS: 30000,
      })
      .toArray();

    const response = {
      candidates: fullCandidates,
      totalCount,
    };

    // Cache response for pagination
    if (page > 1) {
      cache.set(cacheKey, response, 30000);
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Error fetching candidates:", error);
    return NextResponse.json(
      { error: "Failed to fetch candidates", details: error.message },
      { status: 500 }
    );
  }
});


