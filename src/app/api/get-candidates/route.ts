import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import {
  ENHANCED_RESTRICTED_CANDIDATE_ACCESS_ENABLED,
  getInactiveNoHistoryCandidateEmails,
  getExpandedCandidateAccessIDs,
  shouldIncludeInactiveNoHistoryAccess,
} from "@/lib/utils/permissions/candidateAccess";

/**
 * ULTRA-FAST CANDIDATE FETCHING
 * 
 * Strategy: Get emails FIRST, paginate IMMEDIATELY, then fetch details
 * This minimizes processing before pagination
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");
    const filterStatus = searchParams.get("filterStatus") || "All Application Statuses";
    const sortBy = searchParams.get("sortBy") || "Recent Activity";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const debug = searchParams.get("debug") === "1";
    // Optional payload controls (useful for AI search fetching "all candidates" without huge CV/interview payloads)
    const includeCvData = searchParams.get("includeCvData") !== "0";
    const includeInterviews = searchParams.get("includeInterviews") !== "0";
    const excludeCareerIds = searchParams.get("excludeCareerIds")?.split(",").filter(Boolean) || [];

    // Parse filters
    const filtersParam = searchParams.get("filters");
    let filters: any = {};
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

    const { db } = await connectMongoDB();
    const userEmail = request.user?.email?.trim();
    const normalizedUserEmail = userEmail ? userEmail.toLowerCase() : null;
    const userEmailLookupValues: string[] = normalizedUserEmail
      ? [...new Set([normalizedUserEmail, userEmail || normalizedUserEmail])]
      : [];

    // Get user's role and career IDs (for access control)
    let userCareerIDs: string[] = [];
    let userRole: string | null = null;
    let hasFullAccess = false;
    let assignedCareerIDs: string[] = [];

    if (userEmail && normalizedUserEmail) {
      // Check user's role in the organization
      const member = await db.collection("members").findOne({
        ...(ENHANCED_RESTRICTED_CANDIDATE_ACCESS_ENABLED
          ? { email: { $in: userEmailLookupValues } }
          : { email: normalizedUserEmail }),
        orgID: orgID,
      });

      if (member) {
        userRole = member.role;
        // Admins and recruiters have full access to all candidates
        hasFullAccess = member.role === "admin" || member.role === "recruiter";
        if (ENHANCED_RESTRICTED_CANDIDATE_ACCESS_ENABLED) {
          assignedCareerIDs = Array.isArray(member?.careers)
            ? member.careers
                .map((id: any) => String(id || "").trim())
                .filter(Boolean)
            : [];
        }
      }

      if (!hasFullAccess) {
        // 1. Get careers where user is explicitly a team member
        const careers = await db
          .collection("careers")
          .find(
            ENHANCED_RESTRICTED_CANDIDATE_ACCESS_ENABLED
              ? { orgID, "teamMembers.email": { $in: userEmailLookupValues } }
              : { orgID, "teamMembers.email": userEmail },
            { projection: { _id: 1, id: 1 }, limit: 1000 }
          )
          .toArray();
        
        const teamMemberCareerIDs = careers.flatMap((c: any) => [
            c._id?.toString(),
            c.id?.toString()
          ].filter(Boolean));

        // 2. Get Expanded Access (Created + Project Careers) via Helper
        let expandedCareerIDs: string[] = [];
        if (ENHANCED_RESTRICTED_CANDIDATE_ACCESS_ENABLED) {
          expandedCareerIDs = await getExpandedCandidateAccessIDs(db, orgID, userEmail, debug);
        }

        // 3. Combine unique IDs
        userCareerIDs = [...new Set([
          ...(ENHANCED_RESTRICTED_CANDIDATE_ACCESS_ENABLED ? assignedCareerIDs : []),
          ...teamMemberCareerIDs,
          ...(ENHANCED_RESTRICTED_CANDIDATE_ACCESS_ENABLED ? expandedCareerIDs : [])
        ])] as string[];
        
        if (!Array.isArray(userCareerIDs)) {
          userCareerIDs = [];
        }
      }
    }

    // ============================================================================
    // STEP 1: Get candidate emails with filters applied (for accurate count)
    // ============================================================================
    // Strategy: Apply all filters using fast distinct queries, then get emails
    // All filters use AND logic - candidate must match ALL applied filters
    
    let candidateEmails: string[] = [];
    let totalCount = 0;

    // First, get all candidate emails for this organization (to scope all filters)
    // This ensures all filters process all data in MongoDB for the organization, just like Skills
    const orgCandidateEmails = await db.collection("affiliations").distinct("applicantInfo.email", {
      orgID
    });

    // Pre-screening filters (from interviews.preScreeningQuestions)
    const preScreeningFilters = Array.isArray(filters?.preScreening) ? filters.preScreening : [];
    const hasPreScreeningFilters = preScreeningFilters.length > 0;

    // Debug (only when explicitly requested)
    if (debug && page === 1 && Array.isArray(filters?.currentPositions) && filters.currentPositions.length > 0) {
      console.log("[get-candidates][debug] orgID:", orgID);
      console.log("[get-candidates][debug] currentPositions:", filters.currentPositions);
      console.log("[get-candidates][debug] orgCandidateEmails count:", orgCandidateEmails.length);
    }

    // First, get emails that match CV-based filters (if any) using fast distinct queries
    let filteredEmails: string[] | null = null;
    const hasCvFilters = filters.skills?.length > 0 || filters.locations?.length > 0 || 
          filters.currentPositions?.length > 0 || filters.minYears || filters.maxYears ||
          filters.minSalary || filters.maxSalary || filters.availability?.length > 0 ||
          filters.workSetup?.length > 0;

    if (hasCvFilters || hasPreScreeningFilters) {
      const cvFilterEmails: string[][] = [];

      // Skills filter - candidate must have ALL selected skills (AND logic)
      if (filters.skills?.length > 0) {
        // Get emails for each skill separately, then intersect them
        const skillEmailLists: string[][] = [];
        for (const skill of filters.skills) {
          // Escape special regex characters and match exact skill name (case-insensitive)
          const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const skillEmails = await db.collection("org-candidate-skills").distinct("candidateEmail", {
            orgID,
            skillName: { $regex: `^${escapedSkill}$`, $options: "i" }
          });
          skillEmailLists.push(skillEmails);
        }
        
        // Intersect all skill email lists (candidate must have ALL skills)
        if (skillEmailLists.length > 0) {
          let intersectionEmails = skillEmailLists[0];
          for (let i = 1; i < skillEmailLists.length; i++) {
            intersectionEmails = intersectionEmails.filter(email => skillEmailLists[i].includes(email));
          }
          cvFilterEmails.push(intersectionEmails);
        }
      }

      // Location filter - candidate must match ANY selected location (OR logic within Location type)
      // Process all data in MongoDB for the organization, just like Skills
      if (filters.locations?.length > 0) {
        // OR logic: one query that matches ANY location
        const locationEmails = await db.collection("applicant-cv").distinct("email", {
          email: { $in: orgCandidateEmails },
          $or: filters.locations.map((loc: string) => ({
            location: { $regex: String(loc || "").trim(), $options: "i" }
          }))
        });
        cvFilterEmails.push(locationEmails);
      }

      // Current Position filter - candidate must match ANY selected position (OR logic)
      // Process all data in MongoDB for the organization, just like Skills and Location
      if (filters.currentPositions?.length > 0) {
        // OR logic: one query that matches ANY position
        const positionEmails = await db.collection("applicant-cv").distinct("email", {
          email: { $in: orgCandidateEmails },
          $or: filters.currentPositions.map((pos: string) => {
            const trimmedPosition = pos.trim();
            if (!trimmedPosition) return null;
            return { currentPosition: { $regex: trimmedPosition, $options: "i" } };
          }).filter(Boolean)
        });
        cvFilterEmails.push(positionEmails);

        if (debug && page === 1) {
          console.log("[get-candidates][debug] currentPositions (OR):", filters.currentPositions, "matched applicant-cv emails:", positionEmails.length);
        }
      }

      // Experience filter - SIMPLE AND INCLUSIVE
      // Filter 1-5 years = includes candidates with 1, 2, 3, 4, 5 years
      // Filter <= 5 years = includes candidates with 0, 1, 2, 3, 4, 5 years
      if (filters.minYears || filters.maxYears) {
        const minYearsNum = filters.minYears ? parseFloat(filters.minYears) : 0;
        const maxYearsNum = filters.maxYears ? parseFloat(filters.maxYears) : 999;
        
        if (debug) {
          console.log("[get-candidates][debug] Experience filter - minYears:", minYearsNum, "maxYears:", maxYearsNum);
        }
        
        // Simple aggregation: extract numeric experience value and filter
        const expPipeline: any[] = [
          {
            $match: {
              email: { $in: orgCandidateEmails },
              numExperience: { $exists: true, $ne: null }
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
            // Filter: expValue must be a valid number
            $match: {
              expValue: { $ne: null, $type: "number" }
            }
          },
          {
            // Apply STRICT range filter - exact comparison
            // "max 5" means <= 5.00 exactly (5.01 is excluded)
            // "1-5" means >= 1.00 AND <= 5.00
            $match: {
              $expr: {
                $and: [
                  { $gte: ["$expValue", minYearsNum] },
                  { $lte: ["$expValue", maxYearsNum] }
                ]
              }
            }
          },
          {
            $project: { email: 1, expValue: 1 }
          }
        ];
        
        const expResults = await db.collection("applicant-cv").aggregate(expPipeline, { allowDiskUse: true, maxTimeMS: 30000 }).toArray();
        
        if (debug) {
          console.log("[get-candidates][debug] Experience filter - found", expResults.length, "candidates");
          // Log some sample values to debug
          const sampleValues = expResults.slice(0, 10).map((doc: any) => ({ email: doc.email, expValue: doc.expValue }));
          console.log("[get-candidates][debug] Experience filter - sample values:", sampleValues);
        }
        
        const expEmails = expResults.map((doc: any) => doc.email).filter(Boolean);
        cvFilterEmails.push(expEmails);
      }

      // Salary filter - Process all data in MongoDB for the organization, just like Skills
      if (filters.minSalary || filters.maxSalary) {
        const salaryMatch: any = {
          email: { $in: orgCandidateEmails }
        };
        const salaryConditions: any[] = [];
        if (filters.minSalary) {
          const min = parseFloat(filters.minSalary);
          salaryConditions.push(
            { askingSalary: { $gte: min } },
            { salary: { $gte: min } },
            { expectedSalary: { $gte: min } }
          );
        }
        if (filters.maxSalary) {
          const max = parseFloat(filters.maxSalary);
          salaryConditions.push(
            { askingSalary: { $lte: max } },
            { salary: { $lte: max } },
            { expectedSalary: { $lte: max } }
          );
        }
        if (salaryConditions.length > 0) {
          salaryMatch.$or = salaryConditions;
          const salaryEmails = await db.collection("applicant-cv").distinct("email", salaryMatch);
          cvFilterEmails.push(salaryEmails);
        }
      }

      // Availability filter - candidate must match ALL selected availability options (AND logic)
      // Process all data in MongoDB for the organization, just like Skills
      if (filters.availability?.length > 0) {
        // Get emails for each availability option separately, then intersect them
        const availabilityEmailLists: string[][] = [];
        for (const availability of filters.availability) {
          const availabilityEmails = await db.collection("applicant-cv").distinct("email", {
            email: { $in: orgCandidateEmails },
            availability: { $regex: availability, $options: "i" }
          });
          availabilityEmailLists.push(availabilityEmails);
        }
        
        // Intersect all availability email lists (candidate must match ALL availability options)
        if (availabilityEmailLists.length > 0) {
          let intersectionEmails = availabilityEmailLists[0];
          for (let i = 1; i < availabilityEmailLists.length; i++) {
            intersectionEmails = intersectionEmails.filter(email => availabilityEmailLists[i].includes(email));
          }
          cvFilterEmails.push(intersectionEmails);
        }
      }

      // Work Setup filter - candidate must match ALL selected work setup options (AND logic)
      // Process all data in MongoDB for the organization, just like Skills
      if (filters.workSetup?.length > 0) {
        // Get emails for each work setup option separately, then intersect them
        const workSetupEmailLists: string[][] = [];
        for (const workSetup of filters.workSetup) {
          const normalizedWorkSetup = workSetup.replace(/\s+/g, "").replace(/-/g, "");
          const workSetupEmails = await db.collection("applicant-cv").distinct("email", {
            email: { $in: orgCandidateEmails },
            $or: [
              { preferredWorkSetup: { $regex: normalizedWorkSetup, $options: "i" } },
              { workSetup: { $regex: normalizedWorkSetup, $options: "i" } }
            ]
          });
          workSetupEmailLists.push(workSetupEmails);
        }
        
        // Intersect all work setup email lists (candidate must match ALL work setup options)
        if (workSetupEmailLists.length > 0) {
          let intersectionEmails = workSetupEmailLists[0];
          for (let i = 1; i < workSetupEmailLists.length; i++) {
            intersectionEmails = intersectionEmails.filter(email => workSetupEmailLists[i].includes(email));
          }
          cvFilterEmails.push(intersectionEmails);
        }
      }

      // Pre-screening Q&A filters (custom + predefined question types) - AND across questions
      // Process all data in MongoDB for the organization, just like Skills
      if (hasPreScreeningFilters) {
        // Optional optimization: if the user is restricted to specific careers, scope to those candidates
        let scopeEmails: string[] = orgCandidateEmails;
        if (userEmail && !hasFullAccess && userCareerIDs.length > 0) {
          const accessibleEmails = await db.collection("interviews").distinct("email", {
            orgID,
            $or: [
              { id: { $in: userCareerIDs } },
              { careerID: { $in: userCareerIDs } },
              { careerId: { $in: userCareerIDs } }
            ]
          });
          scopeEmails = scopeEmails.filter((e: string) => accessibleEmails.includes(e));
        }

        for (const ps of preScreeningFilters) {
          const questionId = ps?.questionId;
          const values = Array.isArray(ps?.values) ? ps.values : [];
          if (!questionId || values.length === 0) continue;

          const emailsForPs = await getEmailsMatchingPreScreeningFilter(db, orgID, scopeEmails, String(questionId), values);
          cvFilterEmails.push(emailsForPs);
        }
      }

      // Intersect all filter email lists (candidate must match ALL filters)
      if (cvFilterEmails.length > 0) {
        filteredEmails = cvFilterEmails[0];
        for (let i = 1; i < cvFilterEmails.length; i++) {
          filteredEmails = filteredEmails.filter(email => cvFilterEmails[i].includes(email));
        }
        // If after intersection we have no matches, set to empty array (not null)
        if (filteredEmails.length === 0) {
          filteredEmails = [];
        }
      }
    }

    if (debug && page === 1 && Array.isArray(filters?.currentPositions) && filters.currentPositions.length > 0) {
      console.log("[get-candidates][debug] filteredEmails after CV filters:", Array.isArray(filteredEmails) ? filteredEmails.length : null);
    }

    // Handle candidate name search (can search by name, email, skills, or position)
    // Process all data in MongoDB for the organization, just like Skills filter
    if (filters.candidateNames?.length > 0) {
      // Process each search term separately and intersect results (AND logic across terms)
      // For each term, we search across multiple fields (OR logic across fields)
      const nameEmailLists: string[][] = [];
      const skillEmailLists: string[][] = [];
      const positionEmailLists: string[][] = [];
      
      for (const searchTerm of filters.candidateNames) {
        const trimmedTerm = searchTerm.trim();
        if (!trimmedTerm) continue;
        
        // Search by name/email in affiliations - process ALL org candidates
        const nameEmails = await db.collection("affiliations").distinct("applicantInfo.email", {
          orgID,
          $or: [
            { "applicantInfo.name": { $regex: trimmedTerm, $options: "i" } },
            { "applicantInfo.email": { $regex: trimmedTerm, $options: "i" } }
          ]
        });
        nameEmailLists.push(nameEmails);
        
        // Also search by skills if search term matches a skill - process ALL org candidates
        const skillEmails = await db.collection("org-candidate-skills").distinct("candidateEmail", {
          orgID,
          skillName: { $regex: trimmedTerm, $options: "i" }
        });
        skillEmailLists.push(skillEmails);

        // Also search by current position - process ALL org candidates
        const positionEmails = await db.collection("applicant-cv").distinct("email", {
          email: { $in: orgCandidateEmails },
          currentPosition: { $regex: trimmedTerm, $options: "i" }
        });
        positionEmailLists.push(positionEmails);
      }
      
      // Combine results: Intersect results for multiple search terms (AND logic across search terms)
      const combinedSearchEmailsPerTerm: string[][] = [];
      for (let i = 0; i < nameEmailLists.length; i++) {
        const termEmails = [
          ...nameEmailLists[i],
          ...skillEmailLists[i],
          ...positionEmailLists[i]
        ];
        combinedSearchEmailsPerTerm.push([...new Set(termEmails)]);
      }
      
      if (combinedSearchEmailsPerTerm.length > 0) {
        let intersectionEmails = combinedSearchEmailsPerTerm[0];
        for (let i = 1; i < combinedSearchEmailsPerTerm.length; i++) {
          intersectionEmails = intersectionEmails.filter(email => combinedSearchEmailsPerTerm[i].includes(email));
        }
        
        const uniqueSearchEmails = intersectionEmails;

        // Combine with CV filters if any (AND logic - candidate must match search AND other filters)
        if (filteredEmails && filteredEmails.length > 0) {
          filteredEmails = filteredEmails.filter(email => uniqueSearchEmails.includes(email));
        } else {
          filteredEmails = uniqueSearchEmails;
        }
      }
    }

    if (userEmail && !hasFullAccess) {
      const shouldIncludeInactiveNoHistory = shouldIncludeInactiveNoHistoryAccess(
        filterStatus,
        hasPreScreeningFilters
      );

      // User is not admin/recruiter - check if they have career assignments
      if (userCareerIDs.length === 0 && !shouldIncludeInactiveNoHistory) {
        // User has no career assignments and no enabled inactive/no-history overlay
        return NextResponse.json({ candidates: [], totalCount: 0 });
      }

      // User has restrictions (has career assignments) - get emails from interviews collection
      const interviewMatch: any = {
        orgID,
        ...(filterStatus !== "All Application Statuses" ? { applicationStatus: filterStatus } : {}),
        $or: [
          { id: { $in: userCareerIDs } },
          { careerID: { $in: userCareerIDs } },
          { careerId: { $in: userCareerIDs } }
        ]
      };

      // Apply CV-based email filter if available
      if (filteredEmails && filteredEmails.length > 0) {
        interviewMatch.email = { $in: filteredEmails };
      } else if (filteredEmails && filteredEmails.length === 0) {
        return NextResponse.json({ candidates: [], totalCount: 0 });
      }

      // Build pipeline for Step 1 - need to sort ALL candidates before pagination
      const step1Pipeline: any[] = [
        { $match: interviewMatch },
        {
          $group: {
            _id: "$email",
            latestUpdated: { $max: "$updatedAt" },
            createdAt: { $min: "$createdAt" }
          }
        }
      ];

      if (shouldIncludeInactiveNoHistory) {
        const scopedCandidateEmails =
          filteredEmails && filteredEmails.length > 0 ? filteredEmails : undefined;

        const inactiveNoHistoryEmails = await getInactiveNoHistoryCandidateEmails(
          db,
          orgID,
          scopedCandidateEmails
        );

        if (inactiveNoHistoryEmails.length > 0) {
          step1Pipeline.push({
            $unionWith: {
              coll: "affiliations",
              pipeline: [
                {
                  $match: {
                    orgID,
                    "applicantInfo.email": { $in: inactiveNoHistoryEmails },
                  },
                },
                {
                  $group: {
                    _id: "$applicantInfo.email",
                    latestUpdated: { $max: null },
                    createdAt: { $min: "$createdAt" },
                  },
                },
              ],
            },
          });

          step1Pipeline.push({
            $group: {
              _id: "$_id",
              latestUpdated: { $max: "$latestUpdated" },
              createdAt: { $min: "$createdAt" },
            },
          });
        }
      }

      // Check if sort requires CV data (Name, Experience, Position, Location)
      const needsCvForSort = sortBy.includes("Name:") || sortBy.includes("Experience:") || 
                             sortBy.includes("Current Position:") || sortBy.includes("Location:");

      if (needsCvForSort) {
        // Lookup affiliations to get name
        step1Pipeline.push({
          $lookup: {
            from: "affiliations",
            let: { email: "$_id" },
            pipeline: [{
              $match: {
                $expr: { $and: [
                  { $eq: ["$applicantInfo.email", "$$email"] },
                  { $eq: ["$orgID", orgID] }
                ]}
              }
            }, {
              $project: {
                name: "$applicantInfo.name",
                email: "$applicantInfo.email"
              }
            }, { $limit: 1 }],
            as: "affiliation"
          }
        });

        // Lookup CV data for sorting
        step1Pipeline.push({
          $lookup: {
            from: "applicant-cv",
            localField: "_id",
            foreignField: "email",
            pipeline: [{
              $project: {
                currentPosition: 1,
                location: 1,
                numExperience: 1
              }
            }, { $limit: 1 }],
            as: "cv"
          }
        });

        step1Pipeline.push({
          $addFields: {
            name: { $arrayElemAt: ["$affiliation.name", 0] },
            currentPosition: { $ifNull: [{ $arrayElemAt: ["$cv.currentPosition", 0] }, ""] },
            location: { $ifNull: [{ $arrayElemAt: ["$cv.location", 0] }, ""] },
            experienceYears: {
              $ifNull: [
                {
                  $cond: {
                    if: { $isArray: { $arrayElemAt: ["$cv.numExperience", 0] } },
                    then: { $toDouble: { $arrayElemAt: [{ $arrayElemAt: ["$cv.numExperience", 0] }, 0] } },
                    else: { $toDouble: { $arrayElemAt: ["$cv.numExperience", 0] } }
                  }
                },
                0
              ]
            },
            activeAt: { $ifNull: ["$latestUpdated", "$createdAt"] }
          }
        });
      } else {
        // For activity-based sorts, we already have the data
        step1Pipeline.push({
          $addFields: {
            activeAt: { $ifNull: ["$latestUpdated", "$createdAt"] }
          }
        });
      }

      // Sort ALL candidates globally before pagination
      const sortStage = buildSortStageForPhase1(sortBy);
      step1Pipeline.push({ $sort: sortStage });

      // Get total count and paginated emails
      step1Pipeline.push({
        $facet: {
          total: [{ $count: "count" }],
          emails: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $project: { email: "$_id" } }
          ]
        }
      });

      const emailAggregation = await db
        .collection("interviews")
        .aggregate(step1Pipeline, { allowDiskUse: true, maxTimeMS: 30000 })
        .toArray();

      totalCount = emailAggregation[0]?.total?.[0]?.count || 0;
      candidateEmails = emailAggregation[0]?.emails?.map((e: any) => e.email) || [];

      if (debug && page === 1 && Array.isArray(filters?.currentPositions) && filters.currentPositions.length > 0) {
        console.log("[get-candidates][debug] (restricted) totalCount:", totalCount, "candidateEmails page size:", candidateEmails.length);
      }

      // Exclude candidates who already have interviews in specified careers
      if (excludeCareerIds.length > 0 && candidateEmails.length > 0) {
        const excludedEmails = await db.collection("interviews").distinct("email", {
          orgID,
          $or: [
            { id: { $in: excludeCareerIds } },
            { careerID: { $in: excludeCareerIds } },
            { careerId: { $in: excludeCareerIds } }
          ]
        });
        
        candidateEmails = candidateEmails.filter(email => !excludedEmails.includes(email));
        totalCount = candidateEmails.length;
      }
    } else {
      // No restrictions - get emails from affiliations
      const affiliationMatch: any = { orgID };
      
      // Apply CV-based email filter if available
      if (filteredEmails && filteredEmails.length > 0) {
        affiliationMatch["applicantInfo.email"] = { $in: filteredEmails };
      } else if (filteredEmails && filteredEmails.length === 0) {
        return NextResponse.json({ candidates: [], totalCount: 0 });
      }

      // Add candidate name filter if applied (if not already in filteredEmails)
      if (filters.candidateNames?.length > 0 && !filteredEmails) {
        affiliationMatch.$or = [
          { "applicantInfo.name": { $regex: filters.candidateNames.join("|"), $options: "i" } },
          { "applicantInfo.email": { $regex: filters.candidateNames.join("|"), $options: "i" } }
        ];
      }

      // Build pipeline for Step 1 - need to sort ALL candidates before pagination
      const step1Pipeline: any[] = [
        { $match: affiliationMatch },
        {
          $group: {
            _id: {
              email: "$applicantInfo.email",
              name: "$applicantInfo.name"
            },
            createdAt: { $min: "$createdAt" }
          }
        }
      ];

      // Check if sort requires CV data (Experience, Position, Location)
      const needsCvForSort = sortBy.includes("Experience:") || 
                             sortBy.includes("Current Position:") || 
                             sortBy.includes("Location:");

      if (needsCvForSort) {
        // Lookup CV data for sorting
        step1Pipeline.push({
          $lookup: {
            from: "applicant-cv",
            localField: "_id.email",
            foreignField: "email",
            pipeline: [{
              $project: {
                currentPosition: 1,
                location: 1,
                numExperience: 1
              }
            }, { $limit: 1 }],
            as: "cv"
          }
        });

        step1Pipeline.push({
          $addFields: {
            name: "$_id.name",
            currentPosition: { $ifNull: [{ $arrayElemAt: ["$cv.currentPosition", 0] }, ""] },
            location: { $ifNull: [{ $arrayElemAt: ["$cv.location", 0] }, ""] },
            experienceYears: {
              $ifNull: [
                {
                  $cond: {
                    if: { $isArray: { $arrayElemAt: ["$cv.numExperience", 0] } },
                    then: { $toDouble: { $arrayElemAt: [{ $arrayElemAt: ["$cv.numExperience", 0] }, 0] } },
                    else: { $toDouble: { $arrayElemAt: ["$cv.numExperience", 0] } }
                  }
                },
                0
              ]
            },
            activeAt: "$createdAt"
          }
        });
      } else {
        // For name or activity-based sorts, we already have the data
        step1Pipeline.push({
          $addFields: {
            name: "$_id.name",
            activeAt: "$createdAt"
          }
        });
      }

      // Sort ALL candidates globally before pagination
      const sortStage = buildSortStageForPhase1(sortBy);
      step1Pipeline.push({ $sort: sortStage });

      // Get total count and paginated emails
      step1Pipeline.push({
        $facet: {
          total: [{ $count: "count" }],
          emails: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $project: { email: "$_id.email" } }
          ]
        }
      });

      const emailAggregation = await db
        .collection("affiliations")
        .aggregate(step1Pipeline, { allowDiskUse: true, maxTimeMS: 30000 })
        .toArray();

      totalCount = emailAggregation[0]?.total?.[0]?.count || 0;
      candidateEmails = emailAggregation[0]?.emails?.map((e: any) => e.email) || [];

      if (debug && page === 1 && Array.isArray(filters?.currentPositions) && filters.currentPositions.length > 0) {
        console.log("[get-candidates][debug] (unrestricted) totalCount:", totalCount, "candidateEmails page size:", candidateEmails.length);
      }

      // Exclude candidates who already have interviews in specified careers
      if (excludeCareerIds.length > 0 && candidateEmails.length > 0) {
        const excludedEmails = await db.collection("interviews").distinct("email", {
          orgID,
          $or: [
            { id: { $in: excludeCareerIds } },
            { careerID: { $in: excludeCareerIds } },
            { careerId: { $in: excludeCareerIds } }
          ]
        });
        
        candidateEmails = candidateEmails.filter(email => !excludedEmails.includes(email));
        totalCount = candidateEmails.length;
      }
    }

    if (candidateEmails.length === 0) {
      return NextResponse.json({ candidates: [], totalCount: 0 });
    }

    // ============================================================================
    // STEP 2: Fetch full details ONLY for the batch we need (FAST - only 20 candidates)
    // ============================================================================
    
    // Build final projection dynamically to avoid Mongo's "cannot mix inclusion and exclusion" rule.
    // In an inclusion projection, specifying `field: 0` is invalid unless it's `_id`.
    const detailProject: any = {
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
    };
    if (includeInterviews) {
      detailProject.interviews = 1;
    }
    if (includeCvData) {
      detailProject.cvData = 1;
    }

    const detailPipeline: any[] = [
      {
        $match: {
          orgID,
          "applicantInfo.email": { $in: candidateEmails }
        }
      },
      {
        $lookup: {
          from: "interviews",
          let: { email: "$applicantInfo.email" },
          pipeline: [{
            $match: {
              $expr: { $and: [
                { $eq: ["$email", "$$email"] },
                { $eq: ["$orgID", orgID] },
                ...(!hasFullAccess && userCareerIDs.length > 0 && Array.isArray(userCareerIDs) ? [{
                  $or: [
                    { $in: [{ $ifNull: [{ $toString: "$id" }, ""] }, userCareerIDs] },
                    { $in: [{ $ifNull: [{ $toString: "$careerID" }, ""] }, userCareerIDs] },
                    { $in: [{ $ifNull: [{ $toString: "$careerId" }, ""] }, userCareerIDs] }
                  ]
                }] : [])
              ]}
            },
            ...(filterStatus !== "All Application Statuses" ? [
              { applicationStatus: filterStatus }
            ] : [])
          }],
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
      {
        $project: {
          ...detailProject
        }
      },
      { $sort: buildSortStage(sortBy) }
    ];

    // Apply filters if needed (only on the 20 candidates we fetched)
    //
    // IMPORTANT:
    // These CV-style filters are already applied in STEP 1 by producing `filteredEmails`
    // and using that list to select `candidateEmails` BEFORE pagination.
    // Re-applying them here can incorrectly drop candidates (e.g., if a derived field like
    // `currentPosition` is computed differently than the source field used in STEP 1).
    //
    // Therefore: only apply this fallback filtering when STEP 1 did NOT produce a filtered email list.
    if (filteredEmails == null && (
      filters.skills?.length > 0 || filters.locations?.length > 0 || 
      filters.currentPositions?.length > 0 || filters.minYears || filters.maxYears ||
      filters.minSalary || filters.maxSalary || filters.availability?.length > 0 ||
      filters.workSetup?.length > 0
    )) {
      
      // Add filter stage before final projection
      const filterConditions: any[] = [];

      if (filters.skills?.length > 0) {
        filterConditions.push({
          $expr: {
            $anyElementTrue: {
              $map: {
                input: "$skills",
                as: "skill",
                in: {
                  $in: [{ $toLower: "$$skill" }, filters.skills.map((s: string) => s.toLowerCase())]
                }
              }
            }
          }
        });
      }

      if (filters.locations?.length > 0) {
        filterConditions.push({
          $or: filters.locations.map((loc: string) => ({
            location: { $regex: loc, $options: "i" }
          }))
        });
      }

      if (filters.currentPositions?.length > 0) {
        filterConditions.push({
          $or: filters.currentPositions.map((pos: string) => ({
            currentPosition: { $regex: pos, $options: "i" }
          }))
        });
      }

      if (filters.minYears || filters.maxYears) {
        const minYearsNum = filters.minYears ? parseFloat(filters.minYears) : 0;
        const maxYearsNum = filters.maxYears ? parseFloat(filters.maxYears) : 999;
        // STRICT comparison - "max 5" means <= 5.00 exactly
        filterConditions.push({
          $expr: {
            $and: [
              { $gte: ["$experienceYears", minYearsNum] },
              { $lte: ["$experienceYears", maxYearsNum] }
            ]
          }
        });
      }

      if (filters.minSalary || filters.maxSalary) {
        filterConditions.push({
          $or: [
            ...(filters.minSalary ? [
              { askingSalary: { $gte: parseFloat(filters.minSalary) } },
              { salary: { $gte: parseFloat(filters.minSalary) } },
              { expectedSalary: { $gte: parseFloat(filters.minSalary) } }
            ] : []),
            ...(filters.maxSalary ? [
              { askingSalary: { $lte: parseFloat(filters.maxSalary) } },
              { salary: { $lte: parseFloat(filters.maxSalary) } },
              { expectedSalary: { $lte: parseFloat(filters.maxSalary) } }
            ] : [])
          ]
        });
      }

      if (filters.availability?.length > 0) {
        filterConditions.push({
          $or: filters.availability.map((avail: string) => ({
            availability: { $regex: avail, $options: "i" }
          }))
        });
      }

      if (filters.workSetup?.length > 0) {
        filterConditions.push({
          $or: [
            ...filters.workSetup.map((ws: string) => ({
              preferredWorkSetup: { $regex: ws.replace(/\s+/g, "").replace(/-/g, ""), $options: "i" }
            })),
            ...filters.workSetup.map((ws: string) => ({
              workSetup: { $regex: ws.replace(/\s+/g, "").replace(/-/g, ""), $options: "i" }
            }))
          ]
        });
      }

      if (filterConditions.length > 0) {
        // Insert filter before final projection
        const projectIndex = detailPipeline.findIndex((stage: any) => stage.$project);
        if (projectIndex > 0) {
          detailPipeline.splice(projectIndex, 0, {
            $match: { $and: filterConditions }
          });
        }
      }
    }

    const candidates = await db
      .collection("affiliations")
      .aggregate(detailPipeline, { allowDiskUse: true, maxTimeMS: 30000 })
      .toArray();

    if (debug && page === 1 && Array.isArray(filters?.currentPositions) && filters.currentPositions.length > 0) {
      console.log("[get-candidates][debug] candidates returned (page):", candidates.length);
    }

    return NextResponse.json({
      candidates,
      totalCount
    });

  } catch (error: any) {
    console.error("Error fetching candidates:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch candidates", 
        details: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    );
  }
});

/**
 * Returns candidate emails whose interview preScreeningQuestions match a given questionId and selected values.
 * - Scopes to orgID and the provided email list
 * - For non-range answers: matches if ANY selectedAnswer value equals any provided value (case-insensitive on stringified values)
 * - For range answers (values like {min, max}): matches if candidate min/max overlaps the filter range
 */
async function getEmailsMatchingPreScreeningFilter(
  db: any,
  orgID: string,
  scopeEmails: string[],
  questionId: string,
  values: any[],
): Promise<string[]> {
  if (!scopeEmails || scopeEmails.length === 0) return [];

  const first = values[0];
  const isRange = first && typeof first === "object" && (first.min != null || first.max != null);

  if (isRange) {
    const filterMinRaw = (first as any).min;
    const filterMaxRaw = (first as any).max;
    const filterMin = filterMinRaw != null && String(filterMinRaw).trim() !== "" ? Number(filterMinRaw) : null;
    const filterMax = filterMaxRaw != null && String(filterMaxRaw).trim() !== "" ? Number(filterMaxRaw) : null;

    const pipeline: any[] = [
      { $match: { orgID, email: { $in: scopeEmails }, preScreeningQuestions: { $exists: true } } },
      { $addFields: { interviewId: "$_id" } },
      { $unwind: "$preScreeningQuestions" },
      { $match: { "preScreeningQuestions.id": questionId } },
      {
        $addFields: {
          minVal: {
            $let: {
              vars: {
                mins: {
                  $filter: {
                    input: { $ifNull: ["$preScreeningQuestions.selectedAnswers", []] },
                    as: "a",
                    cond: { $eq: ["$$a.type", "Minimum"] },
                  },
                },
              },
              in: {
                $cond: [
                  { $gt: [{ $size: "$$mins" }, 0] },
                  { $toDouble: { $ifNull: [{ $arrayElemAt: ["$$mins.value", 0] }, null] } },
                  null,
                ],
              },
            },
          },
          maxVal: {
            $let: {
              vars: {
                maxs: {
                  $filter: {
                    input: { $ifNull: ["$preScreeningQuestions.selectedAnswers", []] },
                    as: "a",
                    cond: { $eq: ["$$a.type", "Maximum"] },
                  },
                },
              },
              in: {
                $cond: [
                  { $gt: [{ $size: "$$maxs" }, 0] },
                  { $toDouble: { $ifNull: [{ $arrayElemAt: ["$$maxs.value", 0] }, null] } },
                  null,
                ],
              },
            },
          },
        },
      },
      {
        $match: {
          $expr: {
            $and: [
              { $or: [{ $ne: ["$minVal", null] }, { $ne: ["$maxVal", null] }] },
              ...(filterMin !== null
                ? [
                    {
                      $or: [
                        { $and: [{ $ne: ["$maxVal", null] }, { $gte: ["$maxVal", filterMin] }] },
                        { $and: [{ $eq: ["$maxVal", null] }, { $ne: ["$minVal", null] }, { $gte: ["$minVal", filterMin] }] },
                      ],
                    },
                  ]
                : []),
              ...(filterMax !== null
                ? [
                    {
                      $or: [
                        { $and: [{ $ne: ["$minVal", null] }, { $lte: ["$minVal", filterMax] }] },
                        { $and: [{ $eq: ["$minVal", null] }, { $ne: ["$maxVal", null] }, { $lte: ["$maxVal", filterMax] }] },
                      ],
                    },
                  ]
                : []),
            ],
          },
        },
      },
      { $group: { _id: "$email" } },
    ];

    const rows = await db.collection("interviews").aggregate(pipeline, { allowDiskUse: true, maxTimeMS: 30000 }).toArray();
    return rows.map((r: any) => r._id).filter(Boolean);
  }

  // Non-range: match ANY selected answer against ANY provided value (stringified, case-insensitive)
  const wanted = values
    .map((v: any) => String(v ?? "").trim().toLowerCase())
    .filter((v: string) => v.length > 0);
  if (wanted.length === 0) return [];

  const pipeline: any[] = [
    { $match: { orgID, email: { $in: scopeEmails }, preScreeningQuestions: { $exists: true } } },
    { $unwind: "$preScreeningQuestions" },
    { $match: { "preScreeningQuestions.id": questionId } },
    { $unwind: "$preScreeningQuestions.selectedAnswers" },
    {
      $addFields: {
        ansStr: { $toLower: { $toString: "$preScreeningQuestions.selectedAnswers.value" } },
      },
    },
    { $match: { ansStr: { $in: wanted } } },
    { $group: { _id: "$email" } },
  ];

  const rows = await db.collection("interviews").aggregate(pipeline, { allowDiskUse: true, maxTimeMS: 30000 }).toArray();
  return rows.map((r: any) => r._id).filter(Boolean);
}

/**
 * Build sort stage based on sortBy parameter
 */
/**
 * Build sort stage for Phase 1 (listing query)
 * Fields are at root level after $addFields
 */
function buildSortStageForPhase1(sortBy: string): any {
  const sortMap: Record<string, any> = {
    "Recent Activity": { activeAt: -1 },
    "Oldest Activity": { activeAt: 1 },
    "Last Active: Newest": { activeAt: -1 },
    "Last Active: Oldest": { activeAt: 1 },
    "Name: A-Z": { name: 1 },
    "Name: Z-A": { name: -1 },
    "Experience: Low to High": { experienceYears: 1 },
    "Experience: High to Low": { experienceYears: -1 },
    "Current Position: A-Z": { currentPosition: 1 },
    "Current Position: Z-A": { currentPosition: -1 },
    "Location: A-Z": { location: 1 },
    "Location: Z-A": { location: -1 }
  };

  return sortMap[sortBy] || { activeAt: -1 };
}

/**
 * Build sort stage for Phase 2 (detail query)
 * Fields are at root level after $project
 */
function buildSortStage(sortBy: string): any {
  const sortMap: Record<string, any> = {
    "Recent Activity": { activeAt: -1 },
    "Oldest Activity": { activeAt: 1 },
    "Last Active: Newest": { activeAt: -1 },
    "Last Active: Oldest": { activeAt: 1 },
    "Name: A-Z": { name: 1 },
    "Name: Z-A": { name: -1 },
    "Experience: Low to High": { experienceYears: 1 },
    "Experience: High to Low": { experienceYears: -1 },
    "Current Position: A-Z": { currentPosition: 1 },
    "Current Position: Z-A": { currentPosition: -1 },
    "Location: A-Z": { location: 1 },
    "Location: Z-A": { location: -1 }
  };

  return sortMap[sortBy] || { activeAt: -1 };
}
