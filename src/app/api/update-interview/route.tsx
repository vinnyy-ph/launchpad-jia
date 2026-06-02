import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { sendEmail } from "@/lib/Email";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import {
  checkOrgCreditBalance,
  deductCreditForInterview,
  refundCreditForInterview,
  canChargeForAIInterview,
} from "@/lib/utils/creditTransactions";
import { sendEmailV2 } from "@/lib/utils/emailAutomation";
import { logActivity } from "@/lib/utils/activityLogger";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { data, uid, interviewTransaction, recruiterEvaluation, automationIdsToUse, recruiterAction } =
    await request.json();

  let dataToUpdate = { ...data };

  const { db } = await connectMongoDB();

  // Fetch interview data BEFORE the update for credit tracking
  const interviewBefore = await db.collection("interviews").findOne({
    _id: new ObjectId(uid),
  });

  if (!interviewBefore) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const wasHiredBefore = interviewBefore?.applicationStatus === "Hired";

  const hasScheduledPreScreeningAutoDrop =
    interviewBefore?.preScreeningAutoDrop?.status === "scheduled";
  const isManualInterviewStateChange =
    !!interviewTransaction ||
    typeof dataToUpdate?.applicationStatus !== "undefined" ||
    typeof dataToUpdate?.stageId !== "undefined" ||
    typeof dataToUpdate?.currentStep !== "undefined";

  if (hasScheduledPreScreeningAutoDrop && isManualInterviewStateChange) {
    dataToUpdate.preScreeningAutoDrop = {
      ...interviewBefore.preScreeningAutoDrop,
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: "manual-update",
    };
  }

  // Handle currentStepAlias when moving between stages
  if (interviewTransaction && dataToUpdate.stageId) {
    const career = await db.collection("careers").findOne({ id: interviewBefore.id });
    if (career) {
      // Set currentStepAlias for stages 1 and 2
      if (dataToUpdate.stageId === "1" || dataToUpdate.stageId === "2") {
        const stageAlias = career.pipelineStages?.find((s: any) => s.id === dataToUpdate.stageId)?.alias?.trim();
        if (stageAlias) {
          dataToUpdate.currentStepAlias = stageAlias;
        }
      }
    }
  }

  const updateOperation: any = { $set: { ...dataToUpdate } };
  
  // Clear currentStepAlias when moving to stages other than 1 or 2
  if (interviewTransaction && dataToUpdate.stageId && dataToUpdate.stageId !== "1" && dataToUpdate.stageId !== "2") {
    updateOperation.$unset = { currentStepAlias: "" };
  }

  await db.collection("interviews").updateOne(
    {
      _id: new ObjectId(uid),
    },
    updateOperation
  );

  const interviewData = await db.collection("interviews").findOne({
    _id: new ObjectId(uid),
  });

  const isNowHired = interviewData?.applicationStatus === "Hired";

  const recruiterMember = await db
    .collection("members")
    .findOne({ orgID: interviewData.orgID, email: request.user?.email });

  // Record activity history when candidate is hired (status transition to Hired)
  if (!wasHiredBefore && isNowHired) {
    const career = await db.collection("careers").findOne({ id: interviewData?.id });

    await logActivity({
      db,
      kind: "candidate_hired",
      interview: interviewData,
      career,
      actor: {
        type: "candidate",
        id: interviewData?.candidateId || interviewData?._id?.toString(),
        email: interviewData?.email,
        name: interviewData?.name,
        image:
          interviewData?.image ||
          interviewData?.profileImage ||
          interviewData?.photoURL ||
          undefined,
      },
    });
  }

  // Credit Deduction/Refund Logic
  if (interviewTransaction) {
    const career = await db
      .collection("careers")
      .findOne({ id: interviewData.id });

    if (career) {
      const orgId = career.orgID;
      const isPremiumCareer = career.jobPostType === "premium";

      const isFromAIInterview =
        interviewTransaction.fromStageId === "2" ||
        interviewTransaction.fromStage?.startsWith("AI Interview");
      const isToAIInterview =
        interviewTransaction.toStageId === "2" ||
        interviewTransaction.toStage?.startsWith("AI Interview");

      // Determine if we're moving TO the AI Interview stage
      const isMovingToAIInterview = isToAIInterview && !isFromAIInterview;

      // Determine if we're moving out of AI Interview to another stage
      const isMovingOutOfAIInterview =
        isFromAIInterview &&
        !!interviewTransaction.toStage &&
        !isToAIInterview;

      // Determine if we're dropping while currently in AI Interview
      const isDroppingFromAIInterview =
        interviewTransaction.action === "Dropped" && isFromAIInterview;

      // Determine if we're reconsidering a dropped candidate back to AI Interview
      const isReconsideringToAIInterview =
        interviewTransaction.action === "Reconsidered" &&
        interviewTransaction.fromStage?.startsWith("AI Interview");

      // Apply 14-hour timezone buffer for active plan check
      const now = new Date();
      const nowWithBuffer = new Date(now.getTime() + 14 * 60 * 60 * 1000);

      if (orgId) {
        const org = await db
          .collection("organizations")
          .findOne({ _id: new ObjectId(orgId) });
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
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const hasCreditBasedPlan = !!org?.creditBasedPlan?.planId;
        const creditHasStarted =
          creditPlanStartDate && creditPlanStartDate <= nowWithBuffer;
        const creditIsExpired =
          creditPlanEndDate && creditPlanEndDate < todayStart;
        const hasActiveCreditBasedPlan =
          hasCreditBasedPlan && creditHasStarted && !creditIsExpired;

        const hasPremiumPlan = !!org?.premiumPlan?.planId;
        const premiumHasStarted =
          premiumPlanStartDate && premiumPlanStartDate <= nowWithBuffer;
        const premiumIsExpired =
          premiumPlanEndDate && premiumPlanEndDate < todayStart;
        const hasActivePremiumPlan =
          hasPremiumPlan && premiumHasStarted && !premiumIsExpired;

        // Validate job post type matches active plan when moving to AI Interview
        if (isMovingToAIInterview || isReconsideringToAIInterview) {
          if (isPremiumCareer && !hasActivePremiumPlan) {
            // Rollback the interview update
            await db
              .collection("interviews")
              .updateOne({ _id: new ObjectId(uid) }, { $set: interviewBefore });
            return NextResponse.json(
              {
                error:
                  "This job post is marked as Premium but the organization does not have an active Premium plan. Please update the job post type or assign a Premium plan.",
              },
              { status: 400 },
            );
          }

          if (
            career.jobPostType === "credit-based" &&
            !hasActiveCreditBasedPlan
          ) {
            // Rollback the interview update
            await db
              .collection("interviews")
              .updateOne({ _id: new ObjectId(uid) }, { $set: interviewBefore });
            return NextResponse.json(
              {
                error:
                  "This job post is marked as Credit-based but the organization does not have an active Credit-based plan. Please update the job post type or assign a Credit-based plan.",
              },
              { status: 400 },
            );
          }
        }

        // For credit-based careers (without active premium plan), handle credits
        if (
          !isPremiumCareer &&
          !hasActivePremiumPlan &&
          hasActiveCreditBasedPlan
        ) {
          // Deduct credits when moving TO AI Interview
          if (
            isMovingToAIInterview &&
            canChargeForAIInterview(interviewBefore)
          ) {
            const creditStatus = await checkOrgCreditBalance(db, orgId);
            if (creditStatus.isInsufficient) {
              // Rollback the interview update
              await db
                .collection("interviews")
                .updateOne(
                  { _id: new ObjectId(uid) },
                  { $set: interviewBefore },
                );
              return NextResponse.json(
                {
                  error:
                    "Insufficient credits to move candidate to AI Interview.",
                },
                { status: 402 },
              );
            }
            await deductCreditForInterview(db, orgId, interviewBefore, career);
          }

          // Deduct credits when reconsidering a dropped candidate back to AI Interview
          if (
            isReconsideringToAIInterview &&
            canChargeForAIInterview(interviewBefore)
          ) {
            await deductCreditForInterview(db, orgId, interviewBefore, career);
          }

          // Refund credits when leaving AI Interview or dropping from AI Interview
          if (isMovingOutOfAIInterview || isDroppingFromAIInterview) {
            const wasCharged =
              interviewBefore.creditChargedForAIInterview === true;
            const wasNotRefunded =
              interviewBefore.creditRefundedForAIInterview !== true;
            const hasEverAttempted =
              interviewBefore.aiInterviewEverAttempted === true;
            const hasCompletedInterview =
              !!interviewBefore.analysisResult ||
              interviewBefore.interviewCompleted === true ||
              !!interviewBefore.aiInterviewCompletedAt;
            const interviewNotTaken =
              !hasEverAttempted && !hasCompletedInterview;

            if (wasCharged && wasNotRefunded && interviewNotTaken) {
              await refundCreditForInterview(
                db,
                orgId,
                interviewBefore,
                career,
              );
            }
          }
        }
      }
    }

    // Log the interview history
    await db.collection("interview-history").insertOne({
      ...interviewTransaction,
      createdAt: Date.now(),
    });

    // Record activity history for recruiter actions
    if (interviewTransaction.action && ["Endorsed", "Dropped", "Reconsidered", "Reset"].includes(interviewTransaction.action)) {
      const actorName = request.user?.name || request.user?.email || "Recruiter";
      const actorImage =
        request.user?.image ||
        recruiterMember?.image ||
        recruiterMember?.profileImage ||
        recruiterMember?.photoURL ||
        undefined;
      
      // Resolve stage name from transaction or from updated interview data
      let toStageName = interviewTransaction.toStage;
      if (!toStageName && interviewData?.stageId && interviewData?.pipelineStages) {
        const currentStage = interviewData.pipelineStages.find(
          (s: any) => s.id === interviewData.stageId
        );
        if (currentStage) {
          const substage = currentStage.substages?.find(
            (sub: any) => sub.id === interviewData.substageId
          );
          toStageName = substage ? `${currentStage.name}: ${substage.name}` : currentStage.name;
        }
      }
      toStageName = toStageName || "Unknown Stage";

      const actionKindMap: Record<string, any> = {
        Endorsed: "recruiter_endorsed",
        Dropped: "recruiter_dropped",
        Reconsidered: "recruiter_reconsidered",
        Reset: "recruiter_reset",
      };

      await logActivity({
        db,
        kind: actionKindMap[interviewTransaction.action],
        interview: interviewData,
        career,
        actor: {
          type: "recruiter",
          id: recruiterMember?._id?.toString(),
          email: request.user?.email,
          name: actorName,
          image: actorImage,
        },
        extraMetadata: {
          fromStage: interviewTransaction.fromStage,
          toStage: interviewTransaction.toStage,
          toStageName,
          matchFit: recruiterEvaluation?.matchFit || null,
          evaluationNotes: recruiterEvaluation?.evaluationNotes,
        },
      });
    }

    // Record activity history for retake request approval/rejection
    if (dataToUpdate.retakeRequest && ["Approved", "Rejected"].includes(dataToUpdate.retakeRequest.status)) {
      const actorName = request.user?.name || request.user?.email || "Recruiter";
      const actorImage =
        request.user?.image ||
        recruiterMember?.image ||
        recruiterMember?.profileImage ||
        recruiterMember?.photoURL ||
        undefined;

      await logActivity({
        db,
        kind: "recruiter_reviewed_ai_interview_retake",
        interview: interviewData,
        career,
        actor: {
          type: "recruiter",
          id: recruiterMember?._id?.toString(),
          email: request.user?.email,
          name: actorName,
          image: actorImage,
        },
        extraMetadata: {
          decision: dataToUpdate.retakeRequest.status.toLowerCase(),
        },
      });
    }

    // Update career lastActivityAt to current date
    await db
      .collection("careers")
      .updateOne(
        { id: interviewData.id },
        { $set: { lastActivityAt: new Date() } },
      );
  }

  if (recruiterEvaluation) {
    const existingEvaluation = await db
      .collection("recruiter-evaluations")
      .findOne({
        action: recruiterEvaluation.action,
        interviewUID: uid,
        stageId: recruiterEvaluation.stageId,
        substageId: recruiterEvaluation.substageId,
      });

    if (existingEvaluation) {
      await db.collection("recruiter-evaluations").updateOne(
        {
          _id: existingEvaluation._id,
        },
        {
          $set: {
            matchFit: recruiterEvaluation.matchFit,
            evaluationNotes: recruiterEvaluation.evaluationNotes,
            updatedAt: Date.now(),
            updatedBy: recruiterEvaluation.updatedBy,
          },
        },
      );
    } else {
      await db.collection("recruiter-evaluations").insertOne({
        ...recruiterEvaluation,
        interviewUID: uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  const from_stage = `${interviewBefore.pipelineStages.find((item) => item.id == interviewBefore.stageId)?.name}: ${interviewBefore.pipelineStages.find((item) => item.id == interviewBefore.stageId)?.substages.find((substage) => substage.id == interviewBefore.substageId)?.name}`;
  const to_stage = `${interviewData.pipelineStages.find((item) => item.id == interviewData.stageId)?.name}: ${interviewData.pipelineStages.find((item) => item.id == interviewData.stageId)?.substages.find((substage) => substage.id == interviewData.substageId)?.name}`;
  const userId =
    recruiterMember?._id.toString() || null;

  sendEmailV2({
    stage_id: interviewData.stageId,
    substage_id: interviewData.substageId,
    trigger_on_event: interviewTransaction.action,
    from_stage,
    to_stage,
    orgID: interviewData.orgID,
    careerId: interviewTransaction.careerId,
    email: interviewData.email,
    userId, // Pass logged-in user ID for "User" sender
    automationIdsToUse, // When provided, only run these automation IDs (from candidate action modal toggles)
  });

  // Log activity for automated emails triggered by actions (endorse, drop, reconsider, reset)
  if (interviewTransaction?.action && ["Endorsed", "Dropped", "Reconsidered", "Reset"].includes(interviewTransaction.action)) {
    try {
      const career = await db.collection("careers").findOne({ id: interviewData.id });
      
      // Get recruiter info for actor details
      const recruiter = await db.collection("members").findOne({
        orgID: interviewData.orgID,
        email: request.user?.email,
      });

      await logActivity({
        db,
        kind: "recruiter_emailed_candidate",
        interview: interviewData,
        career,
        actor: {
          type: "recruiter",
          id: recruiter?.uid || recruiter?._id?.toString(),
          email: request.user?.email,
          name: recruiter?.name || request.user?.email,
          image: recruiter?.image || recruiter?.photoURL,
        },
        extraMetadata: {
          emailSubject: `${interviewTransaction.action} - ${to_stage}`,
        },
      });
    } catch (logError) {
      console.error("Error logging automated email activity:", logError);
      // Don't fail the action if logging fails
    }
  }

  // await sendEmail({
  //   recipient: interviewData.email,
  //   html: `
  //     <div>
  //       <p>Dear ${interviewData.name},</p>
  //       <p>Your interview has been successfully updated.</p>
  //     </div>
  //   `,
  // });

  if (recruiterAction) {
    await db.collection("recruiter-history").insertOne({
      ...recruiterAction,
      createdAt: Date.now(),
    });
  }

  return NextResponse.json({
    message: "Successfully Completed Interview",
  });
});
