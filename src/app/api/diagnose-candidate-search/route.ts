import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

/**
 * Diagnostic API to check candidate search issues
 * Helps identify:
 * 1. If a candidate's affiliation has correct name/email
 * 2. If the candidate appears in search results
 * 3. User's access permissions
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");
    const candidateEmail = searchParams.get("candidateEmail");
    const searchTerm = searchParams.get("searchTerm") || "";

    if (!orgID) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const { db } = await connectMongoDB();
    const userEmail = request.user?.email;

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      orgID,
      userEmail,
      candidateEmail,
      searchTerm,
    };

    // 1. Check user's role and access
    let userRole: string | null = null;
    let userCareerIDs: string[] = [];
    let isAdmin = false;

    if (userEmail) {
      const member = await db.collection("members").findOne({
        email: userEmail.toLowerCase(),
        orgID: orgID,
      });

      if (member) {
        userRole = member.role;
        isAdmin = member.role === "admin" || member.role === "recruiter";
        
        // Get user's career IDs
        const careers = await db
          .collection("careers")
          .find(
            { orgID, "teamMembers.email": userEmail },
            { projection: { _id: 1, id: 1 }, limit: 1000 }
          )
          .toArray();
        
        userCareerIDs = [...new Set(
          careers.flatMap((c: any) => [
            c._id?.toString(),
            c.id?.toString()
          ].filter(Boolean))
        )] as string[];
      }
    }

    diagnostics.userAccess = {
      role: userRole,
      isAdmin,
      careerIDs: userCareerIDs,
      hasRestrictions: userCareerIDs.length > 0,
    };

    // 2. If candidateEmail provided, check their affiliation
    if (candidateEmail) {
      const affiliation = await db.collection("affiliations").findOne({
        "applicantInfo.email": candidateEmail,
        orgID: orgID,
      });

      if (affiliation) {
        diagnostics.affiliation = {
          exists: true,
          name: affiliation.applicantInfo?.name || null,
          email: affiliation.applicantInfo?.email || null,
          image: affiliation.applicantInfo?.image || null,
          hasName: !!affiliation.applicantInfo?.name,
          nameIsEmpty: !affiliation.applicantInfo?.name || affiliation.applicantInfo.name.trim() === "",
          createdAt: affiliation.createdAt,
        };
      } else {
        diagnostics.affiliation = {
          exists: false,
          error: "Affiliation not found for this candidate",
        };
      }

      // Check if candidate has interviews
      const interviews = await db.collection("interviews").find({
        email: candidateEmail,
        orgID: orgID,
      }).toArray();

      diagnostics.interviews = {
        count: interviews.length,
        careerIDs: [...new Set(interviews.map((i: any) => i.id).filter(Boolean))],
        accessibleToUser: userCareerIDs.length === 0 || interviews.some((i: any) => 
          userCareerIDs.includes(i.id?.toString()) || 
          userCareerIDs.includes(i.careerID?.toString()) || 
          userCareerIDs.includes(i.careerId?.toString())
        ),
      };
    }

    // 3. Test search functionality
    if (searchTerm && searchTerm.trim().length >= 2) {
      const searchQuery = searchTerm.trim();
      
      // Test search in affiliations (what search suggestions API does)
      const searchResults = await db.collection("affiliations").find({
        orgID,
        $or: [
          { "applicantInfo.name": { $regex: searchQuery, $options: "i" } },
          { "applicantInfo.email": { $regex: searchQuery, $options: "i" } }
        ]
      }).limit(10).toArray();

      diagnostics.searchTest = {
        query: searchQuery,
        totalMatches: searchResults.length,
        results: searchResults.map((r: any) => ({
          name: r.applicantInfo?.name || "NO NAME",
          email: r.applicantInfo?.email || "NO EMAIL",
        })),
      };

      // Test with access restrictions (if user has restrictions)
      if (userCareerIDs.length > 0) {
        const accessibleEmails = await db.collection("interviews").distinct("email", {
          orgID,
          $or: [
            { id: { $in: userCareerIDs } },
            { careerID: { $in: userCareerIDs } },
            { careerId: { $in: userCareerIDs } }
          ]
        });

        const restrictedResults = searchResults.filter((r: any) => 
          accessibleEmails.includes(r.applicantInfo?.email)
        );

        diagnostics.searchTest.restrictedMatches = restrictedResults.length;
        diagnostics.searchTest.restrictedResults = restrictedResults.map((r: any) => ({
          name: r.applicantInfo?.name || "NO NAME",
          email: r.applicantInfo?.email || "NO EMAIL",
        }));
      }
    }

    // 4. Check for affiliations with missing names
    const affiliationsWithMissingNames = await db.collection("affiliations").countDocuments({
      orgID,
      $or: [
        { "applicantInfo.name": { $exists: false } },
        { "applicantInfo.name": null },
        { "applicantInfo.name": "" },
      ]
    });

    diagnostics.dataQuality = {
      affiliationsWithMissingNames,
      recommendation: affiliationsWithMissingNames > 0 
        ? "Some affiliations have missing names. These candidates won't appear in name-based searches."
        : "All affiliations have names.",
    };

    return NextResponse.json(diagnostics);

  } catch (error: any) {
    console.error("Error in diagnostic API:", error);
    return NextResponse.json(
      { 
        error: "Failed to run diagnostics", 
        details: error.message 
      },
      { status: 500 }
    );
  }
});

