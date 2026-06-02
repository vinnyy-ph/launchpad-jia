import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { encryptPasscode } from "@/lib/EncryptionUtils";
import { buildShareableAssessmentLink } from "@/lib/utils/shareableAssessmentAccess";
import { employerAppURL } from "@/lib/components/CandidateProfileComponents/candidateProfileUtils";
import { logActivity } from "@/lib/utils/activityLogger";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const {
      active,
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
      orgID
    } = await request.json();
    const { db } = await connectMongoDB();

    const interview = await db.collection("interviews").findOne({
      interviewID: interviewId,
      orgID
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


    const profileId = randomUUID();
    const plainPassword = Math.floor(Math.random() * 900_000 + 100_000).toString();
    const encryptedPassword = encryptPasscode(plainPassword, profileId);
    const { link, userNameSlug, jobTitleSlug } = buildShareableAssessmentLink(profileId);

    const shareableAssessment = {
      applicantEmail,
      interviewId,
      interviewUID,
      orgID,
      dateGenerated: new Date(),
      nameVisibility,
      viewableStages,
      cvVersionLabel: cvVersionLabel ?? null,
      showContactDetails: normalizedShowContactDetails,
      showDisplayPhoto: normalizedShowDisplayPhoto,
      showJiaAssessments: normalizedShowJiaAssessments,
      showRecruiterAssessments: normalizedShowRecruiterAssessments,
      // keep for backward compatibility with older consumers
      isContactVisible: normalizedShowContactDetails,
      password: encryptedPassword,
      views: 0,
      active,
      profileId,
      // include slugs if they exist (backward compatibility)
      ...(userNameSlug && { userNameSlug }),
      ...(jobTitleSlug && { jobTitleSlug }),
      createdBy: {
        uid: request.user?.uid ?? null,
        email: request.user?.email ?? null,
        name: (request.user as any)?.name ?? request.user?.email ?? null,
      },
    };

    const result = await db.collection("shareable-assessments").insertOne(shareableAssessment);

    // Log activity for sharing externally
    try {
      // Fetch member profile for actor details
      const member = await db.collection("members").findOne({
        uid: request.user?.uid,
        orgID,
      });

      // Fetch career for complete job information
      const career = await db.collection("careers").findOne({
        id: interview.id,
      });

      const user = request.user as { uid?: string; email?: string; name?: string; picture?: string };
      await logActivity({
        db,
        kind: "recruiter_shared_externally",
        interview,
        career,
        actor: {
          type: "recruiter",
          id: member?.uid || member?._id?.toString() || (user?.uid ?? undefined),
          email: request.user?.email || member?.email,
          name: user?.name || member?.name || request.user?.email,
          image: member?.image || member?.photoURL || (user?.picture ?? undefined),
        },
      });
    } catch (logError) {
      console.error("Error logging external share activity:", logError);
      // Don't fail the share operation if logging fails
    }

    return NextResponse.json({
      success: true,
      link: `${employerAppURL}${link}`,
      password: plainPassword,
      assessmentId: result.insertedId.toString()
    });
  } catch (error) {
    console.error("Error generating shareable link:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
