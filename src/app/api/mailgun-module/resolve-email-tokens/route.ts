import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      careerId,
      orgId,
      applicantId,
      applicantEmail,
      threadId,
      tokensUsed = [],
    } = body;

    const { db } = await connectMongoDB();
    const tokens: Record<string, string> = {};

    // Helper function to check if a token category is used
    const isTokenCategoryUsed = (category: string): boolean => {
      if (!tokensUsed || tokensUsed.length === 0) return true; // Fetch all if not specified
      return tokensUsed.some((token: string) =>
        token.toLowerCase().includes(category.toLowerCase())
      );
    };

    // Resolve IDs from thread if threadId is provided
    let resolvedCareerId = careerId;
    let resolvedOrgId = orgId;
    let resolvedApplicantId = applicantId;

    if (threadId) {
      try {
        const threadQuery = ObjectId.isValid(String(threadId))
          ? { _id: new ObjectId(String(threadId)) }
          : { threadId: String(threadId) };

        const thread = await db
          .collection("mailgun-threads")
          .findOne(threadQuery);

        if (thread) {
          resolvedCareerId = resolvedCareerId || thread.careerId;
          resolvedOrgId = resolvedOrgId || thread.organizationId;
          resolvedApplicantId = resolvedApplicantId || thread.applicantId;
        }
      } catch (error) {
        console.error("Error fetching thread:", error);
      }
    }

    // If careerId not provided, check if applicantEmail has an associated career
    if (!resolvedCareerId && applicantEmail) {
      try {
        const applicant = await db
          .collection("applicants")
          .findOne({ email: applicantEmail });
        if (applicant && applicant.careerId) {
          resolvedCareerId = applicant.careerId;
        }
      } catch (error) {
        console.error("Error fetching applicant careerId:", error);
      }
    }

    // Fetch Career/Job tokens
    if (isTokenCategoryUsed("Job") || isTokenCategoryUsed("Career")) {
      if (!resolvedCareerId) {
        // Check if career tokens are actually used
        const careerTokensUsed = tokensUsed.some((token: string) =>
          ["Job Title", "Job Description", "Career Title"].includes(token)
        );
        if (careerTokensUsed) {
          console.error("[resolve-email-tokens] Career tokens are used in the template, but careerId was not provided");
          return NextResponse.json(
            {
              error:
                "Career tokens are used in the template, but missing required data",
            },
            { status: 400 }
          );
        }
      } else {
        try {
          // Query by "id" field in careers collection
          console.log(
            "[resolve-email-tokens] Looking up career with id:",
            String(resolvedCareerId)
          );
          const career = await db.collection("careers").findOne({
            id: String(resolvedCareerId),
          });

          if (career) {
            console.log(
              "[resolve-email-tokens] Career found:",
              career.jobTitle
            );
            tokens["Job Title"] = career.jobTitle || "";
            tokens["Career Title"] = career.jobTitle || "";
            tokens["Job Description"] = career.description || "";
          } else {
            console.warn(
              "[resolve-email-tokens] Career not found for id:",
              String(resolvedCareerId)
            );
          }
        } catch (error) {
          console.error("Error fetching career:", error);
        }
      }
    }

    // Fetch Organization tokens
    if (
      isTokenCategoryUsed("Organization") ||
      isTokenCategoryUsed("Employer")
    ) {
      if (!resolvedOrgId) {
        const orgTokensUsed = tokensUsed.some((token: string) =>
          [
            "Organization Name",
            "Organization Description",
            "Organization Location",
            "Employer Company Name",
          ].includes(token)
        );
        if (orgTokensUsed) {
          console.error("[resolve-email-tokens] Organization tokens are used in the template, but orgId was not provided");
          return NextResponse.json(
            {
              error:
                "Organization tokens are used in the template, but missing required data",
            },
            { status: 400 }
          );
        }
      } else {
        try {
          const orgQuery = ObjectId.isValid(String(resolvedOrgId))
            ? { _id: new ObjectId(String(resolvedOrgId)) }
            : { _id: resolvedOrgId };

          const organization = await db
            .collection("organizations")
            .findOne(orgQuery);

          if (organization) {
            tokens["Organization Name"] = organization.name || "";
            tokens["Employer Company Name"] = organization.name || "";
            tokens["Organization Description"] = organization.description || "";

            // Concatenate city and province for location
            const locationParts = [
              organization.city,
              organization.province,
            ].filter(Boolean);
            tokens["Organization Location"] = locationParts.join(", ");
          }
        } catch (error) {
          console.error("Error fetching organization:", error);
        }
      }
    }

    // Fetch Candidate tokens
    if (isTokenCategoryUsed("Candidate")) {
      let applicant: any = null;
      let interview: any = null;

      // Try to resolve applicant by email if applicantId not provided
      if (!resolvedApplicantId && applicantEmail) {
        try {
          // First try applicants collection
          applicant = await db
            .collection("applicants")
            .findOne({ email: applicantEmail });
          if (applicant) {
            resolvedApplicantId = applicant._id;
          }

          // Also fetch from interviews collection for additional fields like cvScreeningReason
          interview = await db
            .collection("interviews")
            .findOne({ email: applicantEmail });
        } catch (error) {
          console.error("Error fetching applicant/interview by email:", error);
        }
      }

      if (!resolvedApplicantId && !applicantEmail) {
        const candidateTokensUsed = tokensUsed.some((token: string) =>
          [
            "Candidate First Name",
            "Candidate Last Name",
            "Candidate Full Name",
            "Candidate Email Address",
            "Candidate CV Screening Reasoning",
          ].includes(token)
        );
        if (candidateTokensUsed) {
          console.error("[resolve-email-tokens] Candidate tokens are used in the template, but applicantId or applicantEmail was not provided");
          return NextResponse.json(
            {
              error:
                "Candidate tokens are used in the template, but missing required data",
            },
            { status: 400 }
          );
        }
      } else if (resolvedApplicantId || interview) {
        try {
          // Fetch applicant if we have an ID
          if (resolvedApplicantId && !applicant) {
            const applicantQuery = ObjectId.isValid(String(resolvedApplicantId))
              ? { _id: new ObjectId(String(resolvedApplicantId)) }
              : { _id: resolvedApplicantId };

            applicant = await db
              .collection("applicants")
              .findOne(applicantQuery);
          }

          // Fetch interview if we have an email but haven't fetched it yet
          if (applicantEmail && !interview) {
            interview = await db
              .collection("interviews")
              .findOne({ email: applicantEmail });
          }

          // Use applicant data as primary source, fall back to interview data
          const candidateName =
            applicant?.name || interview?.name || "";
          const candidateEmail =
            applicant?.email || interview?.email || applicantEmail || "";
          const nameParts = candidateName.split(" ").filter(Boolean);

          tokens["Candidate Full Name"] = candidateName;
          tokens["Candidate First Name"] = nameParts[0] || "";
          tokens["Candidate Last Name"] =
            nameParts[nameParts.length - 1] || "";
          tokens["Candidate Email Address"] = candidateEmail;

          // CV Screening Reasoning comes from interviews collection
          tokens["Candidate CV Screening Reasoning"] =
            interview?.cvScreeningReason || "";
        } catch (error) {
          console.error("Error fetching applicant/interview data:", error);
        }
      }
    }

    // Fetch AI Interview Date token
    if (isTokenCategoryUsed("AI Interview Date")) {
      // Calculate 3 days from now in the format: "Month Day, Year" (e.g., "February 7, 2026")
      const aiInterviewDate = new Date(
        new Date().getTime() + 3 * 24 * 60 * 60 * 1000
      ).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      tokens["AI Interview Date"] = aiInterviewDate;
    }

    console.log(
      "[resolve-email-tokens] Returning tokens:",
      Object.keys(tokens).length,
      "tokens found"
    );
    console.log("[resolve-email-tokens] Token values:", tokens);

    return NextResponse.json({
      success: true,
      tokens,
    });
  } catch (error) {
    console.error("Error in resolve-email-tokens route:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check if it's an ObjectId conversion error
    if (errorMessage.includes("24 character hex string")) {
      console.error("[resolve-email-tokens] Invalid ID format. Career IDs should be UUIDs or the 'id' field in careers collection.");
      return NextResponse.json(
        {
          error: "Failed to process email template",
          details: "Invalid ID format.",
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      {
        error: "Failed to process email template",
        details: errorMessage,
      },
      { status: 400 }
    );
  }
}
