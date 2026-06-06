// TODO (Vince) : For Checking

import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { guid, getFirstEnabledStage } from "@/lib/Utils";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { DEFAULT_JOB_PIPELINE } from "../../../../lib/utils/constants";
import { emailAutomation } from "@/lib/utils/emailAutomation";
import { ObjectId } from "mongodb";
import { logActivity } from "@/lib/utils/activityLogger";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { selectedCareer } = await request.json();
  const { db } = await connectMongoDB();
  const newDate = new Date();

  let userDetails = await db
    .collection("applicants")
    .findOne({ email: request.user.email });
  const applicantCV = await db.collection("applicant-cv").findOne({
    email: request.user.email,
  });
  const isPhoneVerified =
    applicantCV?.structuredCV?.contactInfo?.isPhoneVerified === true;
  let verifiedPhoneNumber = `${applicantCV?.structuredCV?.contactInfo?.phone || ""}`.trim();

  // Self-heal older records that were marked verified but do not yet have
  // structuredCV.contactInfo.phone populated.
  if (isPhoneVerified && !verifiedPhoneNumber) {
    const fallbackPhone = `${userDetails?.primaryContactMobileNumber || userDetails?.mobileNumber || userDetails?.phone || ""}`.trim();

    if (fallbackPhone) {
      verifiedPhoneNumber = fallbackPhone;
      await db.collection("applicant-cv").updateOne(
        { email: request.user.email },
        {
          $set: {
            "structuredCV.contactInfo.phone": fallbackPhone,
            updatedAt: newDate,
          },
          $setOnInsert: {
            createdAt: newDate,
            email: request.user.email,
          },
        },
        { upsert: true },
      );
    }
  }

  const hasVerifiedMobileNumber =
    isPhoneVerified && !!verifiedPhoneNumber;

  // T5: SMS/Firebase mobile verification is a paid feature and is out of scope —
  // the manual profile flow validates phone format + uniqueness instead. Allow
  // opting out of the legacy Firebase phone gate via env (default keeps it on);
  // set PHONE_VERIFICATION_REQUIRED=false in dev/demo to apply without it.
  const phoneVerificationRequired =
    process.env.NEXT_PUBLIC_PHONE_VERIFICATION_REQUIRED !== "false";

  if (phoneVerificationRequired && !hasVerifiedMobileNumber) {
    return NextResponse.json(
      {
        error: "phone_verification_required",
        message: "Please verify your mobile number before applying.",
        verificationRequired: true,
      },
      { status: 403 },
    );
  }

  const authUser = {
    email: userDetails?.email || request.user.email,
    image:
      userDetails?.image ||
      request.user.picture ||
      `https://api.dicebear.com/8.x/shapes/svg?seed=${request.user.email}`,
    name:
      userDetails?.name ||
      request.user.name ||
      request.user.email?.split("@")[0] ||
      "Candidate",
  };

  // Fetch career details to get pipeline stages
  const careerDetails = await db.collection("careers").findOne({
    id: selectedCareer.id,
  });

  const pipelineStages = careerDetails?.pipelineStages || DEFAULT_JOB_PIPELINE;
  const firstEnabled = getFirstEnabledStage(pipelineStages);

  if (!firstEnabled) {
    return NextResponse.json(
      { error: "No enabled stages available for this career." },
      { status: 400 },
    );
  }

  const interviewData = {
    ...selectedCareer,
    ...authUser,
    applicationStatus: "Ongoing",
    currentStep: firstEnabled.substage.currentStep,
    status: firstEnabled.substage.status,
    stageId: firstEnabled.stage.id,
    substageId: firstEnabled.substage.id,
    createdAt: newDate,
    updatedAt: newDate,
    interviewID: guid(),
    completedAt: null,
    reviewers: [],
  };

  delete interviewData._id;
  delete interviewData.role;

  const interviewInstance = await db
    .collection("interviews")
    .findOne({ id: interviewData.id, email: interviewData.email });

  if (interviewInstance) {
    return NextResponse.json({
      error: "Job Application Failed.",
      message: "You have a pending application for this role.",
    });
  }

  await db.collection("interviews").insertOne(interviewData);

  // Create org-scoped skill snapshot from candidate's global skills
  const orgID = interviewData.orgID;
  const candidateEmail = interviewData.email;

  if (orgID && candidateEmail) {
    try {
      const globalSkills = await db
        .collection("candidate-skills")
        .find({ candidateEmail })
        .toArray();

      const now = new Date();

      for (const skill of globalSkills) {
        await db.collection("org-candidate-skills").updateOne(
          { candidateEmail, orgID, skillName: skill.skillName },
          {
            $setOnInsert: {
              candidateEmail,
              orgID,
              skillName: skill.skillName,
              source: "candidate", // seeded from candidate profile
              createdAt: now,
            },
            $set: { updatedAt: now },
          },
          { upsert: true },
        );
      }
    } catch (skillError) {
      console.error("Error creating org skill snapshot:", skillError);
      // Don't fail the application if skill sync fails
    }
  }

  const existingAffiliation = await db.collection("affiliations").findOne({
    "applicantInfo.email": interviewData.email,
    orgID: interviewData.orgID,
  });

  if (!existingAffiliation) {
    await db.collection("affiliations").insertOne({
      type: "applicant",
      applicantInfo: {
        name: interviewData.name,
        email: interviewData.email,
        image: interviewData.image,
      },
      createdAt: new Date(),
      orgID: interviewData.orgID,
    });
  } else {
    // Update affiliation with latest name and image to ensure search works correctly
    // This fixes cases where the name was incorrect or missing initially
    await db.collection("affiliations").updateOne(
      {
        "applicantInfo.email": interviewData.email,
        orgID: interviewData.orgID,
      },
      {
        $set: {
          "applicantInfo.name": interviewData.name,
          "applicantInfo.image": interviewData.image,
        },
      },
    );
  }

  const interviewDetails = await db.collection("interviews").findOne({
    id: interviewData.id,
    email: interviewData.email,
  });

  // Record candidate application activity
  await logActivity({
    db,
    kind: "candidate_applied",
    interview: interviewData,
    career: careerDetails,
    actor: {
      type: "candidate",
      email: authUser.email,
      name: authUser.name,
      image: authUser.image,
    },
  });

  const interviewTransaction = {
    interviewUID: interviewDetails?._id?.toString(),
    careerId: careerDetails?._id?.toString(),
    toStage: firstEnabled.substage.name,
    toStageId: firstEnabled.stage.id,
    toSubstageId: firstEnabled.substage.id,
    action: "Applied",
    updatedBy: {
      image: authUser.image,
      name: authUser.name,
      email: authUser.email,
    },
  };

  await db.collection("interview-history").insertOne({
    ...interviewTransaction,
    createdAt: Date.now(),
  });

  const organizationDetails = await db.collection("organizations").findOne({
    _id: new ObjectId(careerDetails.orgID),
  });

  let organizationName = "N/A";

  if (organizationDetails) {
    organizationName = organizationDetails.name;
  }

  emailAutomation({
    stage_id: firstEnabled.stage.id,
    substage_id: firstEnabled.substage.id,
    trigger_on_event: interviewData.currentStep,
    from_stage: null,
    to_stage: `${firstEnabled.stage.name}: ${firstEnabled.substage.name}`,
    career_id: careerDetails?._id?.toString(),
    org_id: careerDetails.orgID,
    interview_id: interviewData.interviewID,
  });
  // emailAutomation({
  // emailDetails: [
  //   interviewData.jobTitle,
  //   organizationName,
  //   user.name,
  //   user.name.split(" ")[0],
  //   `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  // ],
  // fromStage: null,
  // recipientEmail: user.email,
  // stageName: firstEnabled.stage.name,
  // substageName: firstEnabled.substage.name,
  // toStage: `${firstEnabled.stage.name}: ${firstEnabled.substage.name}`,
  // trigger: interviewData.currentStep,
  // });

  return NextResponse.json({
    message: "Interview added successfully",
    interviewData,
  });
});
