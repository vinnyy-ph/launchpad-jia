import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, type AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { employerAppURL } from "@/lib/components/CandidateProfileComponents/candidateProfileUtils";
import { createShareableAssessmentPreviewToken } from "@/lib/utils/shareableAssessmentPreviewToken";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const {
      applicantEmail,
      interviewUID,
      interviewId,
      nameVisibility,
      viewableStages,
      cvVersionLabel,
      isContactVisible,
      showContactDetails,
      showDisplayPhoto,
      showJiaAssessments,
      showRecruiterAssessments,
      orgID,
    } = await request.json();

    if (!orgID || !interviewId || !interviewUID || !viewableStages) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { db } = await connectMongoDB();
    const interview = await db.collection("interviews").findOne({
      interviewID: interviewId,
      orgID,
    });

    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found or access denied" },
        { status: 404 }
      );
    }

    const normalizedShowContactDetails =
      typeof showContactDetails === "boolean"
        ? showContactDetails
        : Boolean(isContactVisible);
    const normalizedShowDisplayPhoto =
      typeof showDisplayPhoto === "boolean" ? showDisplayPhoto : true;
    const normalizedShowJiaAssessments =
      typeof showJiaAssessments === "boolean" ? showJiaAssessments : true;
    const normalizedShowRecruiterAssessments =
      typeof showRecruiterAssessments === "boolean" ? showRecruiterAssessments : true;

    const previewId = `preview-${interviewUID}`;
    const token = createShareableAssessmentPreviewToken({
      previewId,
      applicantEmail,
      interviewId,
      interviewUID,
      orgID,
      nameVisibility,
      viewableStages,
      cvVersionLabel: cvVersionLabel ?? null,
      showContactDetails: normalizedShowContactDetails,
      showDisplayPhoto: normalizedShowDisplayPhoto,
      showJiaAssessments: normalizedShowJiaAssessments,
      showRecruiterAssessments: normalizedShowRecruiterAssessments,
      isContactVisible: normalizedShowContactDetails,
    });

    const link = `${employerAppURL}/candidate-profile/${previewId}?previewToken=${encodeURIComponent(token)}`;

    return NextResponse.json({
      success: true,
      link,
      expiresInSeconds: 600,
    });
  } catch (error) {
    console.error("Error creating shareable preview link:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
