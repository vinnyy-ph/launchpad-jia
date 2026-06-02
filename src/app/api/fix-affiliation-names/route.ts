import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

/**
 * Utility API to fix affiliations with missing names
 * Updates affiliations by pulling name from applicants collection or interviews
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { orgID, dryRun = true } = await request.json();

    if (!orgID) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const { db } = await connectMongoDB();

    // Find affiliations with missing names
    const affiliationsWithMissingNames = await db.collection("affiliations").find({
      orgID,
      $or: [
        { "applicantInfo.name": { $exists: false } },
        { "applicantInfo.name": null },
        { "applicantInfo.name": "" },
      ]
    }).toArray();

    const results = {
      totalFound: affiliationsWithMissingNames.length,
      fixed: 0,
      notFixed: 0,
      details: [] as any[],
    };

    for (const affiliation of affiliationsWithMissingNames) {
      const email = affiliation.applicantInfo?.email;
      if (!email) {
        results.notFixed++;
        results.details.push({
          email: "NO EMAIL",
          reason: "Affiliation has no email",
        });
        continue;
      }

      // Try to get name from applicants collection
      const applicant = await db.collection("applicants").findOne({ email });
      
      // If not found, try to get from interviews
      let name = applicant?.name;
      if (!name) {
        const interview = await db.collection("interviews").findOne({
          email,
          orgID,
        });
        name = interview?.name;
      }

      if (name && name.trim()) {
        if (!dryRun) {
          await db.collection("affiliations").updateOne(
            { _id: affiliation._id },
            {
              $set: {
                "applicantInfo.name": name.trim(),
              },
            }
          );
        }
        results.fixed++;
        results.details.push({
          email,
          name: name.trim(),
          source: applicant ? "applicants" : "interviews",
          action: dryRun ? "Would update" : "Updated",
        });
      } else {
        results.notFixed++;
        results.details.push({
          email,
          reason: "No name found in applicants or interviews collections",
        });
      }
    }

    return NextResponse.json({
      dryRun,
      message: dryRun 
        ? `Found ${results.totalFound} affiliations with missing names. Run with dryRun: false to fix them.`
        : `Fixed ${results.fixed} out of ${results.totalFound} affiliations.`,
      results,
    });

  } catch (error: any) {
    console.error("Error fixing affiliation names:", error);
    return NextResponse.json(
      { 
        error: "Failed to fix affiliation names", 
        details: error.message 
      },
      { status: 500 }
    );
  }
});

