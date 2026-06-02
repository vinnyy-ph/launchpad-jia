import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { validateShareableAssessmentPasscode } from "@/lib/utils/shareableAssessmentAccess";
import { verifyShareableAssessmentPreviewToken } from "@/lib/utils/shareableAssessmentPreviewToken";
import { DEFAULT_JOB_PIPELINE } from "@/lib/utils/constants";
import { customLog } from "@/lib/CustomLogs";

const ORIGINAL_CV_LABEL = "Original CV";
const MAX_SKILLS = 60;

export async function POST(request: NextRequest) {
  try {
    const { profileId, passcode, previewToken } = await request.json();

    if (!profileId || (!passcode && !previewToken)) {
      console.error("[fetch-shareable-assessment-data] Missing required data: profileId and passcode/previewToken");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    let assessment: any;
    const isPreviewRequest = Boolean(previewToken);

    if (previewToken) {
      const previewValidation = verifyShareableAssessmentPreviewToken(previewToken);
      if (!previewValidation.valid) {
        const errorMessage =
          "message" in previewValidation
            ? previewValidation.message
            : "Invalid preview token.";
        return NextResponse.json({ error: errorMessage }, { status: 400 });
      }

      if (previewValidation.payload.previewId !== profileId) {
        return NextResponse.json({ error: "Preview token does not match requested profile." }, { status: 400 });
      }

      assessment = {
        ...previewValidation.payload,
        active: true,
      };
    } else {
      // Validate passcode
      const validationResult = await validateShareableAssessmentPasscode(
        profileId,
        passcode,
        null,
        db
      );

      if (validationResult.status === 400) {
        return NextResponse.json({ error: validationResult.message }, { status: 400 });
      }

      if (validationResult.status === 404 || !validationResult.assessment) {
        return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
      }

      if (!validationResult.valid) {
        return NextResponse.json(
          { error: "Incorrect passcode. Please try again." },
          { status: 400 }
        );
      }

      assessment = validationResult.assessment;
    }
    const showContactDetails =
      typeof assessment.showContactDetails === "boolean"
        ? assessment.showContactDetails
        : Boolean(assessment.isContactVisible);
    const showDisplayPhoto =
      typeof assessment.showDisplayPhoto === "boolean"
        ? assessment.showDisplayPhoto
        : true;
    const showJiaAssessments =
      typeof assessment.showJiaAssessments === "boolean"
        ? assessment.showJiaAssessments
        : true;
    const showRecruiterAssessments =
      typeof assessment.showRecruiterAssessments === "boolean"
        ? assessment.showRecruiterAssessments
        : true;

    // Check if assessment is active
    if (!assessment.active) {
      return NextResponse.json(
        { error: "This shareable link is inactive." },
        { status: 403 }
      );
    }

    // Increment view count only for real share links (not previews)
    if (!isPreviewRequest) {
      await db.collection("shareable-assessments").updateOne(
        { profileId },
        { $inc: { views: 1 } }
      );
    }

    // Extract required fields from assessment
    const {
      orgID,
      interviewId,
      interviewUID,
      applicantEmail,
      viewableStages,
    } = assessment;

    // Fetch all required data
    const dataPromises: any = {
      orgData: null,
      interviewData: null,
      recruiterEvaluations: null,
      cvData: null,
      feedback: null,
      transcripts: null,
    };

    try {
      // Always fetch: orgData, interviewData, recruiterEvaluations
      const [orgResult, interviewResult, evaluationsResult] = await Promise.all([
        fetchOrgDetails(db, orgID),
        fetchInterviewDetails(db, interviewId, orgID),
        fetchRecruiterEvaluations(db, interviewUID),
      ]);

      dataPromises.orgData = orgResult;
      dataPromises.interviewData = interviewResult;
      dataPromises.recruiterEvaluations = evaluationsResult;

      // Stage IDs: "1" = CV Screening, "2" = AI Interview
      const cvScreeningViewable = viewableStages?.["1"]?.viewable;
      const aiInterviewViewable = viewableStages?.["2"]?.viewable;

      if (cvScreeningViewable) {
        dataPromises.cvData = await fetchCVData(
          db,
          applicantEmail,
          assessment.orgID,
          assessment.cvVersionLabel
        );
      }

      if (aiInterviewViewable) {
        const [feedbackResult, transcriptsResult] = await Promise.all([
          fetchFeedback(db, orgID, interviewId),
          fetchTranscripts(db, interviewId),
        ]);

        dataPromises.feedback = feedbackResult;
        dataPromises.transcripts = transcriptsResult;
      }

      // Add interviewRecording to response
      dataPromises.interviewRecording = interviewResult?.interviewRecording ?? null;

      return NextResponse.json({
        success: true,
        data: dataPromises,
        assessment: {
          orgID: assessment.orgID,
          interviewId: assessment.interviewId,
          interviewUID: assessment.interviewUID,
          applicantEmail: assessment.applicantEmail,
          nameVisibility: assessment.nameVisibility,
          viewableStages: assessment.viewableStages,
          cvVersionLabel: assessment.cvVersionLabel ?? null,
          showContactDetails,
          showDisplayPhoto,
          showJiaAssessments,
          showRecruiterAssessments,
          // keep backward compatibility for older consumers
          isContactVisible: showContactDetails,
        },
      });
    } catch (fetchError) {
      console.error("Error fetching assessment data:", fetchError);
      customLog({
        name: "Shareable Assessment Data Fetch Error",
        errCode: "FETCH_SHAREABLE_DATA_001",
        errTrace: JSON.stringify(fetchError),
        profileId,
      });

      return NextResponse.json(
        { error: "Failed to fetch assessment data" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in fetch-shareable-assessment-data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Helper function to fetch organization details
async function fetchOrgDetails(db: any, orgID: string) {
  let query;
  try {
    query = { _id: new ObjectId(orgID) };
  } catch (e) {
    query = { _id: orgID };
  }

  const orgDocs = await db
    .collection("organizations")
    .aggregate([
      { $match: query },
      {
        $lookup: {
          from: "organization-plans",
          let: { creditBasedPlanId: "$creditBasedPlanId" },
          pipeline: [
            {
              $addFields: {
                _id: { $toString: "$_id" },
              },
            },
            {
              $match: {
                $expr: { $eq: ["$_id", "$$creditBasedPlanId"] },
              },
            },
          ],
          as: "creditBasedPlan",
        },
      },
      {
        $lookup: {
          from: "organization-plans",
          let: { premiumPlanId: "$premiumPlanId" },
          pipeline: [
            {
              $addFields: {
                _id: { $toString: "$_id" },
              },
            },
            {
              $match: {
                $expr: { $eq: ["$_id", "$$premiumPlanId"] },
              },
            },
          ],
          as: "premiumPlan",
        },
      },
    ])
    .toArray();

  return orgDocs && orgDocs.length > 0 ? orgDocs[0] : null;
}

// Helper function to fetch interview details
async function fetchInterviewDetails(db: any, interviewId: string, orgID: string) {
  const query: any = { interviewID: interviewId };
  if (orgID) {
    query.orgID = orgID;
  }

  let interview = await db.collection("interviews").findOne(query);

  if (!interview) {
    return null;
  }

  const settings = await db.collection("global-settings").findOne({
    name: "global-settings",
  });

  const career = await db.collection("careers").findOne({ id: interview.id });

  if (career) {
    interview.careerID = career._id;
    interview.pipelineStages = career.pipelineStages || DEFAULT_JOB_PIPELINE;
  }

  interview.config = settings;

  return interview;
}

// Helper function to fetch recruiter evaluations
async function fetchRecruiterEvaluations(db: any, interviewUID: string) {
  const evaluations = await db
    .collection("recruiter-evaluations")
    .find({ interviewUID })
    .sort({ createdAt: -1 })
    .toArray();

  return evaluations;
}

// Helper function to fetch CV data
async function fetchCVData(
  db: any,
  email: string,
  orgID?: string,
  cvVersionLabel?: string | null
) {
  if (!email) {
    return null;
  }

  const normalizedLabel =
    typeof cvVersionLabel === "string" ? cvVersionLabel.trim() : "";

  const shouldUseVersionedCV =
    orgID &&
    normalizedLabel &&
    normalizedLabel.toLowerCase() !== ORIGINAL_CV_LABEL.toLowerCase();

  if (shouldUseVersionedCV) {
    const version = await db.collection("applicant-cv-version").findOne(
      {
        orgID,
        candidateEmail: email.trim().toLowerCase(),
        label: normalizedLabel,
      },
      {
        sort: { versionNo: -1, updatedAt: -1 },
      }
    );

    if (version) {
      return {
        ...version,
        email: version.candidateEmail,
      };
    }
  }

  const userCV = await db.collection("applicant-cv").findOne({ email });
  if (!userCV) {
    if (!orgID) return null;
    const orgCandidateSkills = await fetchOrgCandidateSkills(db, email, orgID);
    return orgCandidateSkills.length > 0 ? { orgCandidateSkills } : null;
  }

  if (!orgID) return userCV;

  const orgCandidateSkills = await fetchOrgCandidateSkills(db, email, orgID);
  if (orgCandidateSkills.length === 0) return userCV;

  return {
    ...userCV,
    orgCandidateSkills,
  };
}

async function fetchOrgCandidateSkills(db: any, email: string, orgID: string): Promise<string[]> {
  const normalizedEmail = String(email || "").trim();
  if (!normalizedEmail || !orgID) return [];

  const emailCandidates = Array.from(
    new Set([normalizedEmail, normalizedEmail.toLowerCase()].filter(Boolean))
  );
  const query: any = {
    orgID,
    candidateEmail:
      emailCandidates.length > 1 ? { $in: emailCandidates } : emailCandidates[0],
  };

  const docs = await db.collection("org-candidate-skills").find(query).toArray();
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const doc of docs) {
    const skillName = typeof doc?.skillName === "string" ? doc.skillName.trim() : "";
    if (!skillName) continue;

    const normalizedKey = skillName.toLowerCase();
    if (seen.has(normalizedKey)) continue;

    seen.add(normalizedKey);
    deduped.push(skillName);

    if (deduped.length >= MAX_SKILLS) break;
  }

  return deduped;
}

// Helper function to fetch feedback
async function fetchFeedback(db: any, orgID: string, interviewId: string) {
  const feedbackList = await db
    .collection("feedback")
    .aggregate([
      { $match: { orgID } },
      {
        $lookup: {
          from: "interviews",
          localField: "interviewID",
          foreignField: "interviewID",
          as: "interviewDetails",
        },
      },
      {
        $unwind: {
          path: "$interviewDetails",
          preserveNullAndEmptyArrays: false,
        },
      },
    ])
    .toArray();

  // Filter for the specific interview
  const userFeedback = feedbackList.find((item) => item.interviewID === interviewId);

  return userFeedback
    ? { rating: userFeedback.rating, feedback: userFeedback.feedback }
    : null;
}

// Helper function to fetch transcripts
async function fetchTranscripts(db: any, interviewId: string) {
  const transcripts = await db
    .collection("transcripts")
    .find({ interviewID: interviewId })
    .sort({ time: 1 })
    .toArray();

  return transcripts && transcripts.length > 0 ? transcripts : null;
}
