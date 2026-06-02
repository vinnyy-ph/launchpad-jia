import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import OpenAI from "openai";
import { sendEmail } from "@/lib/Email";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { isStageEnabled, getNextPipelineStage, getEnabledStages } from "@/lib/Utils";
import { DEFAULT_JOB_PIPELINE } from "@/lib/utils/constants";

// Helper function to generate email subject
function generateEmailSubject(
  jobTitle: string,
  companyName: string,
  isPass: boolean
) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (isPass) {
    return `Great News! CV Screening Results - ${jobTitle} at ${companyName} - ${today}`;
  } else {
    return `CV Screening Results - ${jobTitle} at ${companyName} - ${today}`;
  }
}

// Email template functions for CV screening results
function generateCVScreeningPassEmail(
  candidateName: string,
  jobTitle: string,
  companyName: string,
  reason: string,
  jobFitScore: number
) {
  const today = new Date();
  const interviewDeadline = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
  const deadlineFormatted = interviewDeadline.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const plainText = `Hi ${candidateName},

Great news! You have been shortlisted for the ${jobTitle} role. You are one step closer to getting this role.

Important info on the next step: Please finish your AI interview on or before ${deadlineFormatted}.

Reminders
The interview will take around 30 minutes, which widely varies based on the length of your answers.
The interview recording will be reviewed by a human recruiter.
It is best to take in a quiet, distraction-free environment.
Make sure your internet connection is good and stable. 
Allow mic and video permissions before proceeding.
Be as authentic as possible in your answers
In case you encounter any technical difficulties, there will be an interview retake request button on your dashboard.

You may login to the Jia Job Portal Link to take your AI interview. Best of luck!

Best Regards,
${companyName} Recruiting Team`;

  const htmlText = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>CV Screening Results - Congratulations!</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#333;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <p>Hi ${candidateName},</p>

    <p>Great news! You have been shortlisted for the <strong>${jobTitle}</strong> role. You are one step closer to getting this role.</p>

    <p><strong>Important info on the next step:</strong> Please finish your AI interview on or before ${deadlineFormatted}.</p>

    <h3>Reminders</h3>
    <ul>
      <li>The interview will take around 30 minutes, which widely varies based on the length of your answers.</li>
      <li>The interview recording will be reviewed by a human recruiter.</li>
      <li>It is best to take in a quiet, distraction-free environment.</li>
      <li>Make sure your internet connection is good and stable.</li>
      <li>Allow mic and video permissions before proceeding.</li>
      <li>Be as authentic as possible in your answers</li>
      <li>In case you encounter any technical difficulties, there will be an interview retake request button on your dashboard.</li>
    </ul>

    <p>You may login to the <a href="https://www.hellojia.ai/dashboard" style="color:#007bff;text-decoration:none;">Jia Job Portal</a> to take your AI interview. Best of luck!</p>

    <p>Best Regards,<br>${companyName} Recruiting Team</p>
  </div>
</body>
</html>`;

  return { plainText, htmlText };
}

function generateCVScreeningFailEmail(
  candidateName: string,
  jobTitle: string,
  companyName: string,
  reason: string,
  jobFitScore: number
) {
  const plainText = `Hi ${candidateName},

Thank you for your interest in the ${jobTitle} position at ${companyName}. After careful review of your CV, we have decided not to move forward with your application at this time.

We encourage you to continue developing your skills and to apply for other positions that may be a better match for your background and experience.

You may continue to explore other opportunities at https://www.hellojia.ai/dashboard.

Best Regards,
${companyName} Recruiting Team`;

  const htmlText = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>CV Screening Results</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#333;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <p>Hi ${candidateName},</p>

    <p>Thank you for your interest in the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>. After careful review of your CV, we have decided not to move forward with your application at this time.</p>

    <p>We encourage you to continue developing your skills and to apply for other positions that may be a better match for your background and experience.</p>

    <p>You may continue to explore other opportunities at <a href="https://www.hellojia.ai/dashboard" style="color:#007bff;text-decoration:none;">https://www.hellojia.ai/dashboard</a>.</p>

    <p>Best Regards,<br>${companyName} Recruiting Team</p>
  </div>
</body>
</html>`;

  return { plainText, htmlText };
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { interviewID, userEmail, testMode, testInterviewData, testCVData } =
    await request.json();

  const { db } = await connectMongoDB();

  let interviewData;

  // set interview data with test mode case
  if (!testMode) {
    interviewData = await db.collection("interviews").findOne({
      interviewID: interviewID,
    });
  } else {
    interviewData = testInterviewData;
  }

  let cvData;

  if (!testMode) {
    cvData = await db.collection("applicant-cv").findOne({
      email: userEmail,
    });
  } else {
    cvData = testCVData;
  }

  let cvScreeningPromptData = await db.collection("global-settings").findOne(
    {
      name: "global-settings",
    },
    {
      projection: {
        cv_screening_prompt: 1,
      },
    }
  );

  const cvScreeningPromptText =
    cvScreeningPromptData?.cv_screening_prompt?.prompt;

  if (!interviewData) {
    return NextResponse.json({
      message: "[CV Screening Error] Interview not found - Operation Aborted",
    });
  }

  if (!cvData) {
    let noCVError = {
      cvStatus: "No CV",
      stateClass: "state-muted",
      cvSettingResult: null,
      cvScreeningReason: "Applicant has no CV uploaded.",
    };

    await db.collection("interviews").updateOne(
      { interviewID: interviewID },
      {
        $set: noCVError,
      }
    );

    return NextResponse.json(noCVError);
  }

  let parsedCV = "";

  cvData.digitalCV.forEach((section) => {
    parsedCV += `${section.name}\n${section.content}\n`;
  });

  // Fetch career details to get cvSecretPrompt
  const careerDetails = await db.collection("careers").findOne({
    id: interviewData.id,
  });
  const cvSecretPrompt = careerDetails?.cvSecretPrompt || "";

  function generateScreeningPrompt(
    interviewInstance: any,
    cvData: any,
    cvScreeningPromptText: any,
    secretPrompt: string
  ) {
    if (!interviewInstance) {
      console.error("Error: interviewInstance parameter is missing");
      return "";
    }

    if (!cvData) {
      console.error("Error: cvData parameter is missing");
      return "";
    }

    if (!cvScreeningPromptText) {
      console.error("Error: cvScreeningPromptText parameter is missing");
      return "";
    }

    let promptText = `
    You are a helpful AI assistant. 
  You are given a candidate's CV and a job description.
  You need to screen the candidate's CV and determine if they are a good fit for the job.

  Job Details:
  Job Title: 
  ${interviewInstance.jobTitle}
  Job Description: 
  ${interviewInstance.description}

  Applicant CV information:
  Applicant Name: ${interviewInstance.name}

  Applicant CV:
  ${parsedCV}

  Processing Steps: 
  ${cvScreeningPromptText}
  ${
    secretPrompt
      ? `\n\nAdditional Evaluation Guidelines (Secret Prompt):\n${secretPrompt}`
      : ""
  }
  - format your response as json: 
  {
    "result": <Result (No Fit / Bad Fit / Good Fit / Strong Fit / Ineligible CV / Insufficient Data)>,
    "reason": <Reason>,
    "confidence": <AI Assessment Confidence (0-100)>
    "jobFitScore": <Overall Score (0-100)>
  } 
  - return only the code JSON, nothing else.
  - carefully analyze the applicant's CV and job description
  - be as accurate as possible
  - give a detailed reason for the result, be clear, concise, and specific.
  - set result to Ineligible CV if the applicant's CV is not in the correct format.
  - set result to Insufficient Data if the applicant's CV is missing important information.
  - do not include any other text or comments.
  `;

    return promptText;
  }

  let screeningPrompt = generateScreeningPrompt(
    interviewData,
    parsedCV,
    cvScreeningPromptText,
    cvSecretPrompt
  );

  // console.log(screeningPrompt);

  const completion = await openai.responses.create({
    model: "o4-mini",
    reasoning: { effort: "high" },
    input: [
      {
        role: "user",
        content: screeningPrompt,
      },
    ],
  });

  let result: any = completion.output_text;

  try {
    result = result.replace("```json", "").replace("```", "");
    result = JSON.parse(result);
  } catch (error) {
    console.log(error);
    return NextResponse.json({
      message: "[Error] Invalid JSON",
    });
  }

  let screeningData: any = {
    cvStatus: result.result,
    stateClass: "state-accepted",
    cvSettingResult: null,
    cvScreeningReason: result.reason,
    currentStep: "CV Screening",
    confidence: result.confidence,
    jobFitScore: result.jobFitScore,
  };

  if (result.result === "No Fit" || result.result === "Bad Fit") {
    screeningData.stateClass = "state-rejected";
    screeningData.cvSettingResult = "Failed";
  }

  // manage state class
  if (result.result === "Good Fit") {
    screeningData.stateClass = "state-good";
    screeningData.cvSettingResult = "Passed";
  }

  if (result.result === "Strong Fit") {
    screeningData.stateClass = "state-accepted";
    screeningData.cvSettingResult = "Passed";
  }

  if (
    result.result === "Ineligible CV" ||
    result.result === "Insufficient Data"
  ) {
    screeningData.stateClass = "state-rejected";
    screeningData.cvSettingResult = "Failed";
  }

  // Get pipeline stages for proper stage transitions
  const pipelineStages = careerDetails?.pipelineStages || DEFAULT_JOB_PIPELINE;
  const cvScreeningStage = pipelineStages.find((s: any) => s.name === "CV Screening");
  const aiInterviewStage = pipelineStages.find((s: any) => s.name === "AI Interview");
  const isAiInterviewEnabled = aiInterviewStage && isStageEnabled(aiInterviewStage);

  // Helper function to get next stage after CV Screening
  const getNextStageForPromotion = () => {
    if (isAiInterviewEnabled) {
      // AI Interview is enabled, promote to it
      const firstSubstage = aiInterviewStage.substages?.[0];
      return {
        currentStep: firstSubstage?.currentStep || "AI Interview",
        status: firstSubstage?.status || "For Interview",
        stageId: aiInterviewStage.id,
        substageId: firstSubstage?.id,
      };
    } else {
      // AI Interview is disabled, find next enabled stage after CV Screening
      const nextStage = getNextPipelineStage(pipelineStages, {
        stage: "CV Screening",
        substage: cvScreeningStage?.substages?.[cvScreeningStage.substages.length - 1]?.name || "For Review",
      });
      if (nextStage) {
        return {
          currentStep: nextStage.substage.currentStep,
          status: nextStage.substage.status,
          stageId: nextStage.stage.id,
          substageId: nextStage.substage.id,
        };
      }
      // Fallback: stay in CV Screening if no next stage
      return null;
    }
  };

  // check screening setting
  if (interviewData.screeningSetting) {
    if (interviewData.screeningSetting === "Only Strong Fit") {
      if (result.result === "Strong Fit") {
        const nextStageData = getNextStageForPromotion();
        screeningData.stateClass = "state-accepted";
        screeningData.cvSettingResult = "Passed";
        if (nextStageData) {
          screeningData.currentStep = nextStageData.currentStep;
          screeningData.status = nextStageData.status;
          screeningData.stageId = nextStageData.stageId;
          screeningData.substageId = nextStageData.substageId;
        }
      } else {
        screeningData.stateClass = "state-rejected";
        screeningData.cvSettingResult = "Failed";
        screeningData.status = "Failed CV Screening";
      }
    }

    if (interviewData.screeningSetting === "Good Fit and above") {
      if (result.result === "Good Fit" || result.result === "Strong Fit") {
        const nextStageData = getNextStageForPromotion();
        screeningData.stateClass = "state-accepted";
        screeningData.cvSettingResult = "Passed";
        if (nextStageData) {
          screeningData.currentStep = nextStageData.currentStep;
          screeningData.status = nextStageData.status;
          screeningData.stageId = nextStageData.stageId;
          screeningData.substageId = nextStageData.substageId;
        }
      } else {
        screeningData.stateClass = "state-rejected";
        screeningData.cvSettingResult = "Failed";
        screeningData.status = "Failed CV Screening";
      }
    }
  }

  if (!testMode) {
    await db
      .collection("interviews")
      .updateOne({ interviewID: interviewID }, { $set: screeningData });
  }

  if (testMode) {
    screeningData.testMode = true;
  }

  // Send email notification to candidate
  if (!testMode && userEmail) {
    try {
      // Fetch organization name
      let companyName = "JIA"; // Default fallback
      if (interviewData.orgID) {
        const organization = await db.collection("organizations").findOne({
          _id: new ObjectId(interviewData.orgID),
        });
        if (organization && organization.name) {
          companyName = organization.name;
        }
      }

      let emailContent = { plainText: "", htmlText: "" };
      let emailSubject = "";

      // Determine email template based on screening result
      if (result.result === "Good Fit" || result.result === "Strong Fit") {
        emailContent = generateCVScreeningPassEmail(
          interviewData.name,
          interviewData.jobTitle,
          companyName,
          result.reason,
          result.jobFitScore
        );
        emailSubject = generateEmailSubject(
          interviewData.jobTitle,
          companyName,
          true
        );
      } else {
        emailContent = generateCVScreeningFailEmail(
          interviewData.name,
          interviewData.jobTitle,
          companyName,
          result.reason,
          result.jobFitScore
        );
        emailSubject = generateEmailSubject(
          interviewData.jobTitle,
          companyName,
          false
        );
      }

      await sendEmail({
        recipient: userEmail,
        text: emailContent.plainText,
        html: emailContent.htmlText,
        subject: emailSubject,
      });
    } catch (emailError) {
      console.error("Failed to send CV screening email:", emailError);
      // Don't fail the entire request if email fails
    }
  }

  return NextResponse.json(screeningData);
});
