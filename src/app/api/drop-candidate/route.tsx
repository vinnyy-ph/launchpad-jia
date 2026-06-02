import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { getCurrentPipelineStage } from "@/lib/Utils";
import { sendEmail } from "@/lib/Email";
import { DEFAULT_JOB_PIPELINE } from "../../../lib/utils/constants";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { refundCreditForInterview } from "@/lib/utils/creditTransactions";


export const POST = withAuth(async (request: AuthenticatedRequest) => {
    const { uid, user, recruiterEvaluation } = await request.json();

    if (!uid || !user) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
        const { db } = await connectMongoDB();
        const interview = await db.collection("interviews").findOne({ _id: new ObjectId(uid) });

        if (!interview) {
            return NextResponse.json({ error: "Interview not found" }, { status: 404 });
        }

        if (interview.applicationStatus === "Dropped") {
            return NextResponse.json({ error: "Candidate already dropped" }, { status: 400 });
        }

        const career = await db.collection("careers").findOne({ id: interview.id });

        if (!career) {
            return NextResponse.json({ error: "Career not found" }, { status: 404 });
        }

        const update: any = {
            applicationStatus: "Dropped",
            updatedAt: Date.now(),
            applicationMetadata: {
                updatedAt: Date.now(),
                updatedBy: {
                    image: user.image,
                    name: user.name,
                    email: user.email,
                },
                action: "Dropped",
            }
        }
        if (interview?.preScreeningAutoDrop?.status === "scheduled") {
            update.preScreeningAutoDrop = {
                ...interview.preScreeningAutoDrop,
                status: "cancelled",
                cancelledAt: new Date(),
                cancelledBy: "manual-drop",
            };
        }
        const currentStage = getCurrentPipelineStage(career.pipelineStages || DEFAULT_JOB_PIPELINE, { status: interview.status, currentStep: interview.currentStep, stageId: interview.stageId, substageId: interview.substageId });
        const interviewTransaction = {
            interviewUID: interview._id.toString(),
            careerId: career._id.toString(),
            fromStage: `${currentStage.stage.name}: ${currentStage.substage.name}`,
            fromStageId: currentStage.stage.id,
            fromSubstageId: currentStage.substage.id,
            action: "Dropped",
            updatedBy: {
                image: user?.image,
                name: user?.name,
                email: user?.email,
            },
        }
        await db.collection("interviews").updateOne({ _id: new ObjectId(uid) }, { $set: { ...update } });
        await db.collection("interview-history").insertOne({
            ...interviewTransaction,
            createdAt: Date.now(),
        });
        await db.collection("recruiter-history").insertOne({
            interviewUID: interview._id.toString(),
            orgID: interview.orgID,
            action: "Dropped",
            recruiterEmail: user?.email,
            createdAt: Date.now(),
        });

        // Update career lastActivityAt to current date
        await db.collection("careers").updateOne(
            { id: interview.id },
            { $set: { lastActivityAt: new Date() } }
        );

        // Credit refund: If dropping from AI Interview before interview was taken
        // Apply 14-hour timezone buffer for active plan check
        const isInAIInterviewStage =
            currentStage?.stage?.id === "2" ||
            currentStage?.stage?.name === "AI Interview";
        const wasCharged = interview.creditChargedForAIInterview === true;
        const wasNotRefunded = interview.creditRefundedForAIInterview !== true;
        const hasEverAttempted = interview.aiInterviewEverAttempted === true;
        const hasCompletedInterview =
            !!interview.analysisResult ||
            interview.interviewCompleted === true ||
            !!interview.aiInterviewCompletedAt;
        const interviewNotTaken =
            !hasEverAttempted && !hasCompletedInterview;
        const orgId = career?.orgID;
        const isPremiumCareer = career?.jobPostType === "premium";

        if (isInAIInterviewStage && wasCharged && wasNotRefunded && interviewNotTaken && orgId && career && !isPremiumCareer) {
            const now = new Date();
            const nowWithBuffer = new Date(now.getTime() + 14 * 60 * 60 * 1000);
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const org = await db.collection("organizations").findOne({ _id: new ObjectId(orgId) });
            const creditPlanStartDate = org?.creditBasedPlan?.startDate
                ? new Date(org.creditBasedPlan.startDate)
                : null;
            const creditPlanEndDate = org?.creditBasedPlan?.endDate
                ? new Date(org.creditBasedPlan.endDate)
                : null;

            const hasCreditBasedPlan = !!org?.creditBasedPlan?.planId;
            const hasStarted = creditPlanStartDate && creditPlanStartDate <= nowWithBuffer;
            const isExpired = creditPlanEndDate && creditPlanEndDate < todayStart;
            const hasActiveCreditBasedPlan = hasCreditBasedPlan && hasStarted && !isExpired;

            if (hasActiveCreditBasedPlan) {
                await refundCreditForInterview(db, orgId, interview, career);
            }
        }

        if (recruiterEvaluation) {
            const existingEvaluation = await db.collection("recruiter-evaluations").findOne({
                action: recruiterEvaluation.action,
                interviewUID: uid,
                stageId: recruiterEvaluation.stageId,
                substageId: recruiterEvaluation.substageId,
            });

            if (existingEvaluation) {
                await db.collection("recruiter-evaluations").updateOne({
                    _id: existingEvaluation._id,
                }, {
                    $set: {
                        matchFit: recruiterEvaluation.matchFit,
                        evaluationNotes: recruiterEvaluation.evaluationNotes,
                        updatedAt: Date.now(),
                        updatedBy: recruiterEvaluation.updatedBy,
                    },
                });
            } else {
                await db.collection("recruiter-evaluations").insertOne({
                    ...recruiterEvaluation,
                    interviewUID: uid,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                });
            }
        }

        await sendEmail({
            recipient: interview.email,
            html: `
              <div>
                <p>Dear ${interview.name},</p>
                <p>Your interview has been successfully updated.</p>
              </div>
            `,
        });
        return NextResponse.json({ message: "Candidate dropped", updatedInterview: { ...interview, ...update } });
    } catch (error) {
        console.error("Error dropping candidate:", error);
        return NextResponse.json({ error: "Failed to drop candidate" }, { status: 500 });
    }

});
