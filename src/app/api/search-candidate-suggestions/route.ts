import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import {
  ENHANCED_RESTRICTED_CANDIDATE_ACCESS_ENABLED,
  getAccessibleInterviewEmails,
  getExpandedCandidateAccessIDs,
  getInactiveNoHistoryCandidateEmails,
  shouldIncludeInactiveNoHistoryAccess,
} from "@/lib/utils/permissions/candidateAccess";

/**
 * Search suggestions API for candidate search
 * Returns candidates, skills and positions matching the query with candidate counts
 * Processes all data in MongoDB for the organization, just like Skills filter
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");
    const query = searchParams.get("q") || "";

    if (!orgID) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ 
        candidates: [],
        skills: [],
        positions: []
      });
    }

    const { db } = await connectMongoDB();
    const searchTerm = query.trim();
    const useEnhancedRestrictedAccess = ENHANCED_RESTRICTED_CANDIDATE_ACCESS_ENABLED;

    // Get user's role and career IDs (for access control)
    const userEmail = request.user?.email?.trim();
    const normalizedUserEmail = userEmail ? userEmail.toLowerCase() : null;
    const userEmailLookupValues: string[] = normalizedUserEmail
      ? [...new Set([normalizedUserEmail, userEmail || normalizedUserEmail])]
      : [];
    let userCareerIDs: string[] = [];
    let hasFullAccess = false;
    let assignedCareerIDs: string[] = [];

    if (userEmail && normalizedUserEmail) {
      // Check user's role in the organization
      const member = await db.collection("members").findOne({
        ...(useEnhancedRestrictedAccess
          ? { email: { $in: userEmailLookupValues } }
          : { email: normalizedUserEmail }),
        orgID: orgID,
      });

      if (member) {
        // Admins and recruiters have full access to all candidates
        hasFullAccess = member.role === "admin" || member.role === "recruiter";
        if (useEnhancedRestrictedAccess) {
          assignedCareerIDs = Array.isArray(member?.careers)
            ? member.careers
                .map((id: any) => String(id || "").trim())
                .filter(Boolean)
            : [];
        }
      }

      // Get user's career IDs (only if they don't have full access)
      if (!hasFullAccess) {
        const careers = await db
          .collection("careers")
          .find(
            useEnhancedRestrictedAccess
              ? { orgID, "teamMembers.email": { $in: userEmailLookupValues } }
              : { orgID, "teamMembers.email": userEmail },
            { projection: { _id: 1, id: 1 }, limit: 1000 }
          )
          .toArray();

        userCareerIDs = [...new Set(
          careers.flatMap((c: any) => [
            c._id?.toString(),
            c.id?.toString()
          ].filter(Boolean))
        )] as string[];

        if (useEnhancedRestrictedAccess) {
          userCareerIDs = [...new Set([...assignedCareerIDs, ...userCareerIDs])];

          const expandedCareerIDs = await getExpandedCandidateAccessIDs(db, orgID, userEmail);
          userCareerIDs = [...new Set([...userCareerIDs, ...expandedCareerIDs])] as string[];
        }
      }
    }

    let restrictedAllowedEmails: string[] | null = null;
    if (useEnhancedRestrictedAccess && userEmail && !hasFullAccess) {
      const shouldIncludeInactiveNoHistory = shouldIncludeInactiveNoHistoryAccess(
        "All Application Statuses",
        false
      );

      if (userCareerIDs.length === 0 && !shouldIncludeInactiveNoHistory) {
        return NextResponse.json({
          candidates: [],
          skills: [],
          positions: [],
        });
      }

      const [accessibleInterviewEmails, inactiveNoHistoryEmails] = await Promise.all([
        getAccessibleInterviewEmails(db, orgID, userCareerIDs),
        shouldIncludeInactiveNoHistory
          ? getInactiveNoHistoryCandidateEmails(db, orgID)
          : Promise.resolve<string[]>([]),
      ]);

      restrictedAllowedEmails = [...new Set([
        ...accessibleInterviewEmails,
        ...inactiveNoHistoryEmails,
      ])];

      if (restrictedAllowedEmails.length === 0) {
        return NextResponse.json({
          candidates: [],
          skills: [],
          positions: [],
        });
      }
    }

    // Get candidates matching the query (by name or email) with counts
    // Process all data in MongoDB for the organization, just like Skills
    const candidatesPipeline: any[] = [
      {
        $match: {
          orgID,
          $or: [
            { "applicantInfo.name": { $regex: searchTerm, $options: "i" } },
            { "applicantInfo.email": { $regex: searchTerm, $options: "i" } }
          ]
        }
      },
      {
        $group: {
          _id: {
            email: "$applicantInfo.email",
            name: "$applicantInfo.name"
          }
        }
      },
      {
        $project: {
          name: "$_id.name",
          email: "$_id.email",
          count: 1 // Each unique candidate counts as 1
        }
      },
      { $sort: { name: 1 } },
      { $limit: 10 }
    ];

    // If user has restrictions (not admin/recruiter), filter by visible candidate emails
    if (restrictedAllowedEmails) {
      candidatesPipeline[0].$match["applicantInfo.email"] = { $in: restrictedAllowedEmails };
    } else if (!useEnhancedRestrictedAccess && userEmail && !hasFullAccess && userCareerIDs.length > 0) {
      const accessibleEmails = await getAccessibleInterviewEmails(db, orgID, userCareerIDs);
      candidatesPipeline[0].$match["applicantInfo.email"] = { $in: accessibleEmails };
    }

    const candidates = await db
      .collection("affiliations")
      .aggregate(candidatesPipeline, { allowDiskUse: true, maxTimeMS: 5000 })
      .toArray();

    // Get all candidate emails for this organization (to scope positions filter)
    // This ensures positions filter processes all data in MongoDB for the organization, just like Skills
    const orgCandidateEmails = restrictedAllowedEmails || await db.collection("affiliations").distinct("applicantInfo.email", {
      orgID
    });

    // Get skills matching the query with candidate counts
    const skillsPipeline: any[] = [
      {
        $match: {
          orgID,
          skillName: { $regex: searchTerm, $options: "i" }
        }
      },
      {
        $group: {
          _id: "$skillName",
          candidateCount: { $addToSet: "$candidateEmail" }
        }
      },
      {
        $project: {
          skillName: "$_id",
          count: { $size: "$candidateCount" }
        }
      },
      { $sort: { count: -1, skillName: 1 } },
      { $limit: 10 }
    ];

    // If user has restrictions (not admin/recruiter), filter by visible candidate emails
    if (restrictedAllowedEmails) {
      skillsPipeline[0].$match.candidateEmail = { $in: restrictedAllowedEmails };
    } else if (!useEnhancedRestrictedAccess && userEmail && !hasFullAccess && userCareerIDs.length > 0) {
      const accessibleEmails = await getAccessibleInterviewEmails(db, orgID, userCareerIDs);
      skillsPipeline[0].$match.candidateEmail = { $in: accessibleEmails };
    }

    const skills = await db
      .collection("org-candidate-skills")
      .aggregate(skillsPipeline, { allowDiskUse: true, maxTimeMS: 5000 })
      .toArray();

    // Get current positions matching the query with candidate counts
    // Process all data in MongoDB for the organization, just like Skills
    const positionsPipeline: any[] = [
      {
        $match: {
          email: { $in: orgCandidateEmails },
          currentPosition: { $regex: searchTerm, $options: "i" }
        }
      },
      {
        $group: {
          _id: "$currentPosition",
          candidateCount: { $addToSet: "$email" }
        }
      },
      {
        $project: {
          position: "$_id",
          count: { $size: "$candidateCount" }
        }
      },
      { $sort: { count: -1, position: 1 } },
      { $limit: 10 }
    ];

    // If user has restrictions (not admin/recruiter), filter by visible candidate emails
    if (restrictedAllowedEmails) {
      positionsPipeline[0].$match.email = { $in: restrictedAllowedEmails };
    } else if (!useEnhancedRestrictedAccess && userEmail && !hasFullAccess && userCareerIDs.length > 0) {
      const accessibleEmails = await getAccessibleInterviewEmails(db, orgID, userCareerIDs);
      const filteredEmails = orgCandidateEmails.filter((email: string) => accessibleEmails.includes(email));
      positionsPipeline[0].$match.email = { $in: filteredEmails };
    }

    const positions = await db
      .collection("applicant-cv")
      .aggregate(positionsPipeline, { allowDiskUse: true, maxTimeMS: 5000 })
      .toArray();

    return NextResponse.json({
      candidates: candidates.map((c: any) => ({
        name: c.name || c.email || "Unnamed Candidate",
        email: c.email,
        count: 1 // Each candidate is unique
      })),
      skills: skills.map((s: any) => ({
        name: s.skillName,
        count: s.count
      })),
      positions: positions.map((p: any) => ({
        name: p.position,
        count: p.count
      }))
    });

  } catch (error: any) {
    console.error("Error fetching search suggestions:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch suggestions", 
        details: error.message
      },
      { status: 500 }
    );
  }
});
