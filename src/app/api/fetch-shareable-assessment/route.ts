import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { validateShareableAssessmentPasscode } from "@/lib/utils/shareableAssessmentAccess";
import { verifyShareableAssessmentPreviewToken } from "@/lib/utils/shareableAssessmentPreviewToken";

export async function POST(request: NextRequest) {
  try {
    const { assessmentId, passcode, previewToken } = await request.json();

    if (previewToken) {
      const previewValidation = verifyShareableAssessmentPreviewToken(previewToken);
      if (!previewValidation.valid) {
        const errorMessage =
          "message" in previewValidation
            ? previewValidation.message
            : "Invalid preview token.";
        return NextResponse.json({ error: errorMessage }, { status: 400 });
      }

      if (assessmentId && previewValidation.payload.previewId !== assessmentId) {
        return NextResponse.json({ error: "Preview token does not match requested profile." }, { status: 400 });
      }

      const previewAssessment = {
        ...previewValidation.payload,
        active: true,
        dateGenerated: new Date(),
      };

      return NextResponse.json({
        success: true,
        assessment: previewAssessment,
      });
    }

    const result = await validateShareableAssessmentPasscode(
      assessmentId,
      passcode,
      null
    );

    if (result.status === 400) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    if (result.status === 404 || !result.assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (!result.valid) {
      return NextResponse.json({ error: "Incorrect passcode. Please try again." }, { status: 400 });
    }

    const { db } = await connectMongoDB();

    await db.collection("shareable-assessments").updateOne(
      { profileId: assessmentId },
      { $inc: { views: 1 } }
    );

    const formattedAssessment = {
      ...result.assessment,
      _id: result.assessment._id?.toString?.() ?? result.assessment._id,
    };

    const { password, ...sanitizedAssessment } = formattedAssessment;
    const normalizedContactVisibility =
      typeof sanitizedAssessment.showContactDetails === "boolean"
        ? sanitizedAssessment.showContactDetails
        : Boolean(sanitizedAssessment.isContactVisible);

    const normalizedAssessment = {
      ...sanitizedAssessment,
      showContactDetails: normalizedContactVisibility,
      showDisplayPhoto:
        typeof sanitizedAssessment.showDisplayPhoto === "boolean"
          ? sanitizedAssessment.showDisplayPhoto
          : true,
      showJiaAssessments:
        typeof sanitizedAssessment.showJiaAssessments === "boolean"
          ? sanitizedAssessment.showJiaAssessments
          : true,
      showRecruiterAssessments:
        typeof sanitizedAssessment.showRecruiterAssessments === "boolean"
          ? sanitizedAssessment.showRecruiterAssessments
          : true,
      // keep backward compatibility
      isContactVisible: normalizedContactVisibility,
    };

    return NextResponse.json({
      success: true,
      assessment: normalizedAssessment,
    });
  } catch (error) {
    console.error("Error fetching shareable assessment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
