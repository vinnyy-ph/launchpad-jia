// TODO (Vince) : For Checking

import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import OpenAI from "openai";
import { sendEmail } from "@/lib/Email";
import { ObjectId } from "mongodb";
import { DEFAULT_JOB_PIPELINE } from "@/lib/utils/constants";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { getAutomationSettings, isStageEnabled, getNextPipelineStage } from "@/lib/Utils";
import { logActivity } from "@/lib/utils/activityLogger";
// import emailAutomation from "@/lib/utils/emailAutomation";
import {
  checkOrgCreditBalance,
  deductCreditForInterview,
  canChargeForAIInterview,
} from "@/lib/utils/creditTransactions";

// Helper function to generate email subject
// function generateEmailSubject(
//   jobTitle: string,
//   companyName: string,
//   isPass: boolean
// ) {
//   const today = new Date().toLocaleDateString("en-US", {
//     weekday: "long",
//     year: "numeric",
//     month: "long",
//     day: "numeric",
//   });

//   if (isPass) {
//     return `Great News! CV Screening Results - ${jobTitle} at ${companyName} - ${today}`;
//   } else {
//     return `CV Screening Results - ${jobTitle} at ${companyName} - ${today}`;
//   }
// }

// Email template functions for CV screening results
// function generateCVScreeningPassEmail(
//   candidateName: string,
//   jobTitle: string,
//   companyName: string,
//   reason: string,
//   jobFitScore: number
// ) {
//   const today = new Date();
//   const interviewDeadline = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
//   const deadlineFormatted = interviewDeadline.toLocaleDateString("en-US", {
//     weekday: "long",
//     year: "numeric",
//     month: "long",
//     day: "numeric",
//   });

//   const plainText = `Hi ${candidateName},

// Great news! You have been shortlisted for the ${jobTitle} role. You are one step closer to getting this role.

// Important info on the next step: Please finish your AI interview on or before ${deadlineFormatted}.

// Reminders
// The interview will take around 30 minutes, which widely varies based on the length of your answers.
// The interview recording will be reviewed by a human recruiter.
// It is best to take in a quiet, distraction-free environment.
// Make sure your internet connection is good and stable.
// Allow mic and video permissions before proceeding.
// Be as authentic as possible in your answers
// In case you encounter any technical difficulties, there will be an interview retake request button on your dashboard.

// You may login to the Jia Job Portal Link to take your AI interview. Best of luck!

// Best Regards,
// ${companyName} Recruiting Team`;

//   const htmlText = `
// <!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="utf-8">
//   <meta name="viewport" content="width=device-width,initial-scale=1">
//   <title>CV Screening Results - Congratulations!</title>
// </head>
// <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#333;line-height:1.6;">
//   <div style="max-width:600px;margin:0 auto;padding:20px;">
//     <p>Hi ${candidateName},</p>

//     <p>Great news! You have been shortlisted for the <strong>${jobTitle}</strong> role. You are one step closer to getting this role.</p>

//     <p><strong>Important info on the next step:</strong> Please finish your AI interview on or before ${deadlineFormatted}.</p>

//     <h3>Reminders</h3>
//     <ul>
//       <li>The interview will take around 30 minutes, which widely varies based on the length of your answers.</li>
//       <li>The interview recording will be reviewed by a human recruiter.</li>
//       <li>It is best to take in a quiet, distraction-free environment.</li>
//       <li>Make sure your internet connection is good and stable.</li>
//       <li>Allow mic and video permissions before proceeding.</li>
//       <li>Be as authentic as possible in your answers</li>
//       <li>In case you encounter any technical difficulties, there will be an interview retake request button on your dashboard.</li>
//     </ul>

//     <p>You may login to the <a href="https://www.hellojia.ai/dashboard" style="color:#007bff;text-decoration:none;">Jia Job Portal</a> to take your AI interview. Best of luck!</p>

//     <p>Best Regards,<br>${companyName} Recruiting Team</p>
//   </div>
// </body>
// </html>`;

//   return { plainText, htmlText };
// }

// function generateCVScreeningFailEmail(
//   candidateName: string,
//   jobTitle: string,
//   companyName: string,
//   reason: string,
//   jobFitScore: number
// ) {
//   const plainText = `Hi ${candidateName},

// Thank you for your interest in the ${jobTitle} position at ${companyName}. After careful review of your CV, we have decided not to move forward with your application at this time.

// We encourage you to continue developing your skills and to apply for other positions that may be a better match for your background and experience.

// You may continue to explore other opportunities at https://www.hellojia.ai/dashboard.

// Best Regards,
// ${companyName} Recruiting Team`;

//   const htmlText = `
// <!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="utf-8">
//   <meta name="viewport" content="width=device-width,initial-scale=1">
//   <title>CV Screening Results</title>
// </head>
// <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#333;line-height:1.6;">
//   <div style="max-width:600px;margin:0 auto;padding:20px;">
//     <p>Hi ${candidateName},</p>

//     <p>Thank you for your interest in the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>. After careful review of your CV, we have decided not to move forward with your application at this time.</p>

//     <p>We encourage you to continue developing your skills and to apply for other positions that may be a better match for your background and experience.</p>

//     <p>You may continue to explore other opportunities at <a href="https://www.hellojia.ai/dashboard" style="color:#007bff;text-decoration:none;">https://www.hellojia.ai/dashboard</a>.</p>

//     <p>Best Regards,<br>${companyName} Recruiting Team</p>
//   </div>
// </body>
// </html>`;

//   return { plainText, htmlText };
// }

// Helper function to check auto-filtering rules for pre-screening questions
function checkAutoFilteringRules(
  careerQuestions: any[],
  candidateAnswers: any[],
  defaultCurrency?: string
): { shouldDrop: boolean; reason: string } {
  const formatSalary = (value: any, currency?: string) => {
    const numericValue = Number(value);
    const formattedValue = Number.isFinite(numericValue)
      ? numericValue.toLocaleString("en-US")
      : `${value ?? ""}`;
    return currency ? `${currency} ${formattedValue}` : formattedValue;
  };

  // Check each question for auto-filtering
  for (const careerQ of careerQuestions) {
    if (!careerQ.isAutoFiltering) continue;
    
    const candidateQ = candidateAnswers.find((q: any) => q.id === careerQ.id);
    if (!candidateQ) continue;
    
    // Check Dropdown/Checkboxes
    if (["Dropdown", "Checkboxes"].includes(careerQ.questionFormat)) {
      const selectedIds = candidateQ.selectedAnswers?.map((a: any) => a.id) || [];
      const shouldDropCandidate = careerQ.answers.some(
        (answer: any) => selectedIds.includes(answer.id) && answer.dropCandidate === true
      );
      
      if (shouldDropCandidate) {
        const droppedAnswer = careerQ.answers.find(
          (a: any) => selectedIds.includes(a.id) && a.dropCandidate
        );
        return {
          shouldDrop: true,
          reason: `The candidate selected "${droppedAnswer?.value}" for "${careerQ.question}", which is set to auto-disqualify candidate in pre-screening.`
        };
      }
    }
    
    // Check Range questions
    if (careerQ.questionFormat === "Range") {
      const minRuleAnswer = careerQ.answers.find((a: any) => a.type === "Minimum");
      const maxRuleAnswer = careerQ.answers.find((a: any) => a.type === "Maximum");
      const candidateMin = candidateQ.selectedAnswers?.find((a: any) => a.type === "Minimum")?.value;
      const candidateMax = candidateQ.selectedAnswers?.find((a: any) => a.type === "Maximum")?.value;
      
      let shouldDrop = false;
      switch (careerQ.screeningRule) {
        case "Above maximum only":
          shouldDrop = Number(candidateMin) > Number(maxRuleAnswer.value);
          break;
        case "Below minimum only":
          shouldDrop = Number(candidateMax) < Number(minRuleAnswer.value);
          break;
        case "Outside the range":
          shouldDrop = Number(candidateMin) > Number(maxRuleAnswer.value) || 
                       Number(candidateMax) < Number(minRuleAnswer.value);
          break;
      }
      
      if (shouldDrop) {
        const screeningRule = careerQ.screeningRule || "Above maximum only";
        const currency = careerQ.currency || defaultCurrency;
        const candidateRange = `${formatSalary(candidateMin, currency)}-${formatSalary(candidateMax, currency)}`;
        const requiredRange = `${formatSalary(minRuleAnswer?.value, currency)}-${formatSalary(maxRuleAnswer?.value, currency)}`;
        return {
          shouldDrop: true,
          reason: `The candidate entered ${candidateRange} for "${careerQ.question}", which falls under the "${screeningRule}" auto-disqualification rule. The required range is ${requiredRange}.`
        };
      }
    }
  }
  
  return { shouldDrop: false, reason: "" };
}

const PRE_SCREENING_AUTO_DROP_DELAY_MS = 72 * 60 * 60 * 1000;

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { interviewID } = await request.json();
  const userEmail = request.user.email;
  const { db } = await connectMongoDB();
  const interviewData = await db.collection("interviews").findOne({
    interviewID,
    email: userEmail,
  });

  if (!interviewData) {
    return NextResponse.json({
      error: "CV Screening Failed",
      message: "No application found for the selected job.",
    });
  }

  const cvData = await db.collection("applicant-cv").findOne({
    email: userEmail,
  });

  if (!cvData) {
    return NextResponse.json({
      error: "CV Screening Failed",
      message: "You have not uploaded a CV for this application.",
    });
  }

  const cvScreeningPromptData = await db.collection("global-settings").findOne(
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

  // Fetch career details to get cvSecretPrompt
  let careerDetails = null;
  let cvSecretPrompt = "";

  try {
    careerDetails = await db.collection("careers").findOne({
      id: interviewData.id,
    });
    cvSecretPrompt = careerDetails?.cvSecretPrompt || "";
  } catch (error) {
    console.error("Error fetching career details for secret prompt:", error);
    // Continue without secret prompt if there's an error
  }

  // Get pipeline stages from career or default
  const pipelineStages = careerDetails?.pipelineStages || DEFAULT_JOB_PIPELINE;
  const cvScreeningStage = pipelineStages.find((s: any) => s.name === "CV Screening");
  const aiInterviewStage = pipelineStages.find((s: any) => s.name === "AI Interview");
  const isAiInterviewEnabled = aiInterviewStage && isStageEnabled(aiInterviewStage);

  // Check pre-screening auto-filtering rules BEFORE AI CV screening
  const autoFilterResult = checkAutoFilteringRules(
    careerDetails?.preScreeningQuestions || [],
    interviewData?.preScreeningQuestions || [],
    careerDetails?.salaryCurrency
  );
  const shouldSchedulePreScreeningAutoDrop = autoFilterResult.shouldDrop;
  const scheduledPreScreeningAutoDropAt = shouldSchedulePreScreeningAutoDrop
    ? new Date(Date.now() + PRE_SCREENING_AUTO_DROP_DELAY_MS)
    : null;
  const wasAlreadyScheduled =
    interviewData?.preScreeningAutoDrop?.status === "scheduled";
  const shouldCreateAutoDropScheduleHistory =
    shouldSchedulePreScreeningAutoDrop && !wasAlreadyScheduled;

  let parsedCV = "";

  cvData.digitalCV.forEach((section) => {
    parsedCV += `${section.name}\n${section.content}\n`;
  });

  const screeningPrompt = `
    You are a helpful AI assistant.
    You are given a candidate's CV and a job description.
    You need to screen the candidate's CV and determine if they are a good fit for the job.

    Job Details:
      Job Title:
      ${interviewData.jobTitle}
      Job Description:
      ${interviewData.description}

    Applicant CV Information:
      Applicant Name: ${interviewData.name}

    Applicant CV:
      ${parsedCV}

    Processing Steps:
      ${cvScreeningPromptText}
      ${cvSecretPrompt
      ? `\n\nAdditional Evaluation Guidelines (Secret Prompt):\n${cvSecretPrompt}`
      : ""
    }

    - Format your response as JSON:
      {
        "result": <Result (No Fit / Bad Fit / Good Fit / Strong Fit / Ineligible CV / Insufficient Data)>,
        "reason": <Reason>,
        "confidence": <AI Assessment Confidence (0-100)>,
        "jobFitScore": <Overall Score (0-100)>
      }

    Processing Instructions:
      - Return only the code JSON, nothing else.
      - Carefully analyze the applicant's CV and job description.
      - Be as accurate as possible.
      - Give a detailed reason for the result — be clear, concise, and specific.
      - Set result to "Ineligible CV" if the applicant's CV is not in the correct format.
      - Set result to "Insufficient Data" if the applicant's CV is missing important information.
      - Do not include any other text or comments.
      - DO NOT include \`\`\`json or \`\`\` around the response.
  `;

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
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
    updatedAt: Date.now(),
  };
  const newDate = new Date();

  screeningData.statusDate = {
    "CV Screening": newDate,
  };

  let interviewTransaction: any = null;

  // Helper to get next stage for promotion
  const getNextStageForPromotion = () => {
    if (isAiInterviewEnabled) {
      const firstSubstage = aiInterviewStage.substages?.[0];
      return {
        currentStep: firstSubstage?.currentStep || "AI Interview",
        status: firstSubstage?.status || "For Interview",
        stageId: aiInterviewStage.id,
        substageId: firstSubstage?.id,
        stageName: aiInterviewStage.name,
        substageName: firstSubstage?.name,
      };
    } else {
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
          stageName: nextStage.stage.name,
          substageName: nextStage.substage.name,
        };
      }
      return null;
    }
  };

  // Interview history moving to CV Screening
  await db.collection("interview-history").insertOne({
    interviewUID: interviewData._id.toString(),
    careerId: careerDetails?._id?.toString(),
    fromStage: "Applied",
    toStage: "CV Screening",
    fromStageId: cvScreeningStage?.id,
    fromSubstageId: cvScreeningStage?.substages?.[0]?.id,
    toStageId: cvScreeningStage?.id,
    toSubstageId: cvScreeningStage?.substages?.[1]?.id,
    action: "Endorsed",
    updatedBy: {
      image: interviewData?.image,
      name: interviewData?.name,
      email: interviewData?.email,
    },
    createdAt: Date.now(),
  });

  const {
    forReviewResult,
    forDropResult,
    forPromotionResult,
    cvScreeningAutoEndorse,
  } = getAutomationSettings(careerDetails);

  if (forReviewResult.includes(result.result)) {
    screeningData.currentStep = "CV Screening";
    screeningData.status = "For CV Screening";
    screeningData.stageId = cvScreeningStage?.id;
    screeningData.substageId = cvScreeningStage?.substages?.[1]?.id;
  }

  if (forDropResult.includes(result.result)) {
    screeningData.applicationStatus = "Dropped";
    interviewTransaction = {
      interviewUID: interviewData._id.toString(),
      careerId: careerDetails?._id?.toString(),
      fromStage: "CV Screening",
      fromStageId: cvScreeningStage?.id,
      fromSubstageId: cvScreeningStage?.substages?.[1]?.id,
      action: "Dropped",
      updatedBy: {
        name: "Jia",
      },
    };
    screeningData.applicationMetadata = {
      updatedAt: Date.now(),
      updatedBy: {
        name: "Jia",
      },
      action: "Dropped",
    };
  }

  if (
    forPromotionResult.includes(result.result) &&
    !shouldSchedulePreScreeningAutoDrop
  ) {
    // Check credit balance before auto-promoting to AI Interview
    // Skip credit operations for Premium job posts (unlimited AI interviews)
    const orgId = careerDetails?.orgID;
    const isPremiumCareer = careerDetails?.jobPostType === "premium";
    let shouldPromote = true;

    if (orgId && isAiInterviewEnabled) {
      // Apply 14-hour timezone buffer for active plan check
      const now = new Date();
      const nowWithBuffer = new Date(now.getTime() + 14 * 60 * 60 * 1000);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const org = await db.collection("organizations").findOne({ _id: new ObjectId(orgId) });

      // Check for ANY active plan (credit-based or premium)
      const creditPlanStartDate = org?.creditBasedPlan?.startDate
        ? new Date(org.creditBasedPlan.startDate)
        : null;
      const creditPlanEndDate = org?.creditBasedPlan?.endDate
        ? new Date(org.creditBasedPlan.endDate)
        : null;
      const premiumPlanStartDate = org?.premiumPlan?.startDate
        ? new Date(org.premiumPlan.startDate)
        : null;
      const premiumPlanEndDate = org?.premiumPlan?.endDate
        ? new Date(org.premiumPlan.endDate)
        : null;

      const hasCreditBasedPlan = !!org?.creditBasedPlan?.planId;
      const creditHasStarted = creditPlanStartDate && creditPlanStartDate <= nowWithBuffer;
      const creditIsExpired = creditPlanEndDate && creditPlanEndDate < todayStart;
      const hasActiveCreditBasedPlan = hasCreditBasedPlan && creditHasStarted && !creditIsExpired;

      const hasPremiumPlan = !!org?.premiumPlan?.planId;
      const premiumHasStarted = premiumPlanStartDate && premiumPlanStartDate <= nowWithBuffer;
      const premiumIsExpired = premiumPlanEndDate && premiumPlanEndDate < todayStart;
      const hasActivePremiumPlan = hasPremiumPlan && premiumHasStarted && !premiumIsExpired;

      const hasAnyActivePlan = hasActiveCreditBasedPlan || hasActivePremiumPlan;

      if (!hasAnyActivePlan) {
        // No active plan at all, defer promotion
        shouldPromote = false;
        screeningData.creditDeferred = true;
        screeningData.currentStep = "CV Screening";
        screeningData.status = "For CV Screening";
        screeningData.stageId = cvScreeningStage?.id;
        screeningData.substageId = cvScreeningStage?.substages?.[1]?.id;
      } else if (isPremiumCareer && !hasActivePremiumPlan) {
        // Premium career but no active premium plan - defer promotion
        shouldPromote = false;
        screeningData.creditDeferred = true;
        screeningData.currentStep = "CV Screening";
        screeningData.status = "For CV Screening";
        screeningData.stageId = cvScreeningStage?.id;
        screeningData.substageId = cvScreeningStage?.substages?.[1]?.id;
      } else if (careerDetails?.jobPostType === "credit-based" && !hasActiveCreditBasedPlan) {
        // Credit-based career but no active credit-based plan - defer promotion
        shouldPromote = false;
        screeningData.creditDeferred = true;
        screeningData.currentStep = "CV Screening";
        screeningData.status = "For CV Screening";
        screeningData.stageId = cvScreeningStage?.id;
        screeningData.substageId = cvScreeningStage?.substages?.[1]?.id;
      } else if (!isPremiumCareer && !hasActivePremiumPlan && hasActiveCreditBasedPlan) {
        // For credit-based careers and WITHOUT a premium plan, check credit balance
        const creditStatus = await checkOrgCreditBalance(db, orgId);

        if (creditStatus.isLowCredit) {
          // Defer promotion - keep in CV For Review but mark as deferred
          shouldPromote = false;
          screeningData.creditDeferred = true;
          // Keep in CV Screening For Review
          screeningData.currentStep = "CV Screening";
          screeningData.status = "For CV Screening";
          screeningData.stageId = cvScreeningStage?.id;
          screeningData.substageId = cvScreeningStage?.substages?.[1]?.id;
          // Don't create a promotion transaction - candidate stays in CV stage
        }
      }
    }

    if (shouldPromote) {
      const nextStageData = getNextStageForPromotion();
      if (nextStageData) {
        const nextStageTitle = `${nextStageData.stageName}: ${nextStageData.substageName}`;
        screeningData.currentStep = nextStageData.currentStep;
        screeningData.status = nextStageData.status;
        screeningData.statusDate = {
          ...screeningData.statusDate,
          [nextStageData.stageName]: newDate,
        };
        screeningData.stageId = nextStageData.stageId;
        screeningData.substageId = nextStageData.substageId;
        interviewTransaction = {
          interviewUID: interviewData._id.toString(),
          careerId: careerDetails?._id?.toString(),
          fromStage: "CV Screening",
          toStage: nextStageTitle,
          fromStageId: cvScreeningStage?.id,
          fromSubstageId: cvScreeningStage?.substages?.[1]?.id,
          toStageId: nextStageData.stageId,
          toSubstageId: nextStageData.substageId,
          action: "Auto-Promoted",
          updatedBy: {
            name: "Jia",
          },
        };
        screeningData.applicationMetadata = {
          updatedAt: Date.now(),
          updatedBy: {
            name: "Jia",
          },
          action: "Endorsed",
        };

        // Record activity history for CV auto-endorsement
        try {
          await logActivity({
            db,
            kind: "system_endorsed",
            interview: interviewData,
            career: careerDetails,
            extraMetadata: {
              message: "CV auto-endorsed after screening",
              fromStage: "CV Screening",
              toStage: nextStageTitle,
              toStageName: nextStageTitle,
              matchFit: result.result || null,
            },
          });
        } catch (error) {
          console.error("Failed to record activity for CV auto-endorsement:", error);
        }

        // Deduct credits for AI Interview if candidate should be charged
        // Skip for Premium careers (unlimited AI interviews)
        if (orgId && careerDetails && !isPremiumCareer && isAiInterviewEnabled && canChargeForAIInterview(interviewData)) {
          await deductCreditForInterview(db, orgId, interviewData, careerDetails);
        }
      }
    }
  }

  if (cvScreeningAutoEndorse) {
    if (cvScreeningAutoEndorse === "Only Strong Fit") {
      if (result.result == "Good Fit") {
        screeningData.status = "For CV Screening";
        screeningData.stageId = cvScreeningStage?.id;
        screeningData.substageId = cvScreeningStage?.substages?.[1]?.id;
      }
    }
  }

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

  // check screening setting
  if (cvScreeningAutoEndorse) {
    if (cvScreeningAutoEndorse === "Only Strong Fit") {
      if (result.result === "Strong Fit") {
        screeningData.stateClass = "state-accepted";
        screeningData.cvSettingResult = "Passed";
        // screeningData.currentStep = "AI Interview";
        // screeningData.status = "For Interview";
      } else {
        screeningData.stateClass = "state-rejected";
        screeningData.cvSettingResult = "Failed";
        // screeningData.status = "Failed CV Screening";
      }
    }

    if (cvScreeningAutoEndorse === "Good Fit and above") {
      if (result.result === "Good Fit" || result.result === "Strong Fit") {
        screeningData.stateClass = "state-accepted";
        screeningData.cvSettingResult = "Passed";
        // screeningData.currentStep = "AI Interview";
        // screeningData.status = "For Interview";
      } else {
        screeningData.stateClass = "state-rejected";
        screeningData.cvSettingResult = "Failed";
        // screeningData.status = "Failed CV Screening";
      }
    }
  }

  if (shouldSchedulePreScreeningAutoDrop && scheduledPreScreeningAutoDropAt) {
    screeningData.preScreeningAutoDrop = {
      status: "scheduled",
      reason: autoFilterResult.reason,
      scheduledAt: scheduledPreScreeningAutoDropAt,
      createdAt: new Date(),
      source: "pre-screening-auto-filter",
    };
    screeningData.currentStep = "CV Screening";
    screeningData.status = "For CV Screening";
    screeningData.stageId = cvScreeningStage?.id;
    screeningData.substageId = cvScreeningStage?.substages?.[1]?.id;
    screeningData.statusDate = {
      ...screeningData.statusDate,
      "CV Screening": newDate,
    };
    screeningData.applicationMetadata = {
      updatedAt: Date.now(),
      updatedBy: {
        name: "Jia",
      },
      action: "Queued for Auto-Drop",
      reason: autoFilterResult.reason,
      scheduledAt: scheduledPreScreeningAutoDropAt,
    };
    delete screeningData.applicationStatus;
    interviewTransaction = null;
  }

  await db
    .collection("interviews")
    .updateOne({ interviewID: interviewID }, { $set: screeningData });

  if (interviewTransaction) {
    await db.collection("interview-history").insertOne({
      ...interviewTransaction,
      createdAt: Date.now(),
    });
  }

  if (shouldCreateAutoDropScheduleHistory && scheduledPreScreeningAutoDropAt) {
    await db.collection("interview-history").insertOne({
      interviewUID: interviewData._id.toString(),
      careerId: careerDetails?._id?.toString(),
      fromStage: "CV Screening",
      fromStageId: cvScreeningStage?.id,
      fromSubstageId: cvScreeningStage?.substages?.[1]?.id,
      action: "Queued for Auto-Drop",
      reason: autoFilterResult.reason,
      scheduledAt: scheduledPreScreeningAutoDropAt,
      updatedBy: {
        name: "Jia",
      },
      createdAt: Date.now(),
    });
  }
  // Update career lastActivityAt to current date
  await db
    .collection("careers")
    .updateOne(
      { id: interviewData.id },
      { $set: { lastActivityAt: new Date() } }
    );

  // passed
  //   interviewTransaction {
  //   interviewUID: '69244f878984624b7f8f18c9',
  //   careerId: '6867796a02d0d040777b42c7',
  //   fromStage: 'CV Screening',
  //   toStage: 'Pending AI Interview',
  //   fromStageId: '1',
  //   fromSubstageId: '2',
  //   toStageId: '2',
  //   toSubstageId: '1',
  //   action: 'Auto-Promoted',
  //   updatedBy: { name: 'Jia' }
  // }
  // screeningData {
  //   cvStatus: 'Strong Fit',
  //   stateClass: 'state-accepted',
  //   cvSettingResult: 'Passed',
  //   cvScreeningReason: '<h3>Strong Points</h3><ul><li>Extensive full-stack development experience across web, mobile, and AI integrations demonstrating versatility.</li><li>Proactive in learning and researching new technologies (AI tools, Flutter, CI/CD pipelines), aligning with continuous learning.</li><li>Initiated and led DevOps and R&amp;D efforts, showing ownership and initiative.</li><li>Strong collaborative experience through Knowledge Transfer sessions and team support roles.</li><li>Proficient with cloud platforms, containerization, CI/CD, and AI frameworks relevant to White Cloak’s focus.</li></ul><h3>Weak Points</h3><ul><li>No formal education details provided, limiting assessment of academic foundation.</li><li>Potential overqualification for an internship-level role, risking misaligned expectations.</li><li>Lacks explicit portfolio links (e.g., GitHub) and sample projects to gauge code quality and style.</li><li>No direct mention of test-driven development or UI/UX refinement tasks.</li></ul>',
  //   currentStep: 'CV Screening',
  //   confidence: 85,
  //   jobFitScore: 90,
  //   updatedAt: 1763987359611,
  //   statusDate: {
  //     'CV Screening': 2025-11-24T12:29:19.611Z,
  //     'AI Interview': 2025-11-24T12:29:19.611Z
  //   },
  //   status: 'For AI Interview',
  //   stageId: '2',
  //   substageId: '1',
  //   applicationMetadata: {
  //     updatedAt: 1763987359697,
  //     updatedBy: { name: 'Jia' },
  //     action: 'Endorsed'
  //   }
  // }

  const organizationDetails = await db.collection("organizations").findOne({
    _id: new ObjectId(careerDetails.orgID),
  });

  let organizationName = "N/A";

  if (organizationDetails) {
    organizationName = organizationDetails.name;
  }

  let emailDetails = [
    interviewData.jobTitle,
    organizationName,
    interviewData.name,
    interviewData.name.split(" ")[0],
  ];
  let stageName = cvScreeningStage?.name || "CV Screening";
  let fromStage = `${stageName}: ${cvScreeningStage?.substages?.[0]?.name || "Waiting Submission"}`;
  let substageName = cvScreeningStage?.substages?.[1]?.name || "For Review";
  let toStage = `${stageName}: ${substageName}`;
  let trigger: "Drop" | "Endorse" = "Endorse";

  if (interviewTransaction && interviewTransaction.action == "Dropped") {
    emailDetails.push(screeningData.cvScreeningReason);
    toStage = null;
    trigger = "Drop";
  }

  if (interviewTransaction && interviewTransaction.action == "Auto-Promoted") {
    newDate.setDate(newDate.getDate() + 3);
    const formattedDate = newDate.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    emailDetails.push(
      formattedDate,
      `${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN.includes("localhost")
        ? "http"
        : "https"
      }://${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN}`
    );
    const nextStageData = getNextStageForPromotion();
    if (nextStageData) {
      stageName = nextStageData.stageName;
      substageName = nextStageData.substageName;
      toStage = `${stageName}: ${substageName}`;
    }
  }

  // emailAutomation({
  //   emailDetails,
  //   fromStage,
  //   recipientEmail: userEmail,
  //   stageName,
  //   substageName,
  //   toStage,
  //   trigger,
  // });

  // Send email notification to candidate
  // if (userEmail) {
  //   try {
  //     // Fetch organization name
  //     let companyName = "WhiteCloak Technologies"; // Default fallback
  //     if (interviewData.orgID) {
  //       const organization = await db.collection("organizations").findOne({
  //         _id: new ObjectId(interviewData.orgID),
  //       });
  //       if (organization && organization.name) {
  //         companyName = organization.name;
  //       }
  //     }

  //     let emailContent = { plainText: "", htmlText: "" };
  //     let emailSubject = "";

  //     // Determine email template based on screening result
  //     if (result.result === "Good Fit" || result.result === "Strong Fit") {
  //       emailContent = generateCVScreeningPassEmail(
  //         interviewData.name,
  //         interviewData.jobTitle,
  //         companyName,
  //         result.reason,
  //         result.jobFitScore
  //       );
  //       emailSubject = generateEmailSubject(
  //         interviewData.jobTitle,
  //         companyName,
  //         true
  //       );
  //     } else {
  //       emailContent = generateCVScreeningFailEmail(
  //         interviewData.name,
  //         interviewData.jobTitle,
  //         companyName,
  //         result.reason,
  //         result.jobFitScore
  //       );
  //       emailSubject = generateEmailSubject(
  //         interviewData.jobTitle,
  //         companyName,
  //         false
  //       );
  //     }

  //     await sendEmail({
  //       recipient: userEmail,
  //       text: emailContent.plainText,
  //       html: emailContent.htmlText,
  //       subject: emailSubject,
  //     });
  //   } catch (emailError) {
  //     console.error("Failed to send CV screening email:", emailError);
  //     // Don't fail the entire request if email fails
  //   }
  // }

  return NextResponse.json(screeningData);
});
