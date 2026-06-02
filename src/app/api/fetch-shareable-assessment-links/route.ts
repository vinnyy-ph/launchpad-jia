import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { slugify } from "@/lib/Utils";
import { decryptPasscode } from "@/lib/EncryptionUtils";
import { employerAppURL } from "@/lib/components/CandidateProfileComponents/candidateProfileUtils";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { interviewId, orgID } = await request.json();

    const { db } = await connectMongoDB();

    const assessments = await db
      .collection("shareable-assessments")
      .find({ interviewId, orgID })
      .sort({ dateGenerated: -1 })
      .toArray();

    const interview = await db.collection("interviews").findOne({
      interviewID: interviewId,
      orgID
    });

    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    const jobTitle = slugify(interview.jobTitle);

    const formattedAssessments = assessments.map(assessment => {
      // Detect format: if slugs exist, use legacy format
      const link = assessment.userNameSlug && assessment.jobTitleSlug
        ? `${employerAppURL}/candidate-profile/${assessment.userNameSlug}/${jobTitle}/${assessment.profileId}`  // Legacy 3-segment URL
        : `${employerAppURL}/candidate-profile/${assessment.profileId}`;  // New simple URL

      const showContactDetails =
        typeof assessment.showContactDetails === "boolean"
          ? assessment.showContactDetails
          : Boolean(assessment.isContactVisible);
      
      return {
        ...assessment,
        _id: assessment._id.toString(),
        password: decryptPasscode(assessment.password, assessment.profileId),
        showContactDetails,
        showDisplayPhoto:
          typeof assessment.showDisplayPhoto === "boolean"
            ? assessment.showDisplayPhoto
            : true,
        showJiaAssessments:
          typeof assessment.showJiaAssessments === "boolean"
            ? assessment.showJiaAssessments
            : true,
        showRecruiterAssessments:
          typeof assessment.showRecruiterAssessments === "boolean"
            ? assessment.showRecruiterAssessments
            : true,
        // keep backward compatibility for legacy UI
        isContactVisible: showContactDetails,
        link,
        profileId: assessment.profileId
      };
    });

    return NextResponse.json({
      success: true,
      assessments: formattedAssessments
    });
  } catch (error) {
    console.error("Error fetching shareable assessment links:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
