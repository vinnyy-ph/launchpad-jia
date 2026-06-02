import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { getCurrentPipelineStage, getNextPipelineStage } from "@/lib/Utils";
import { sendEmail } from "@/lib/Email";
import { DEFAULT_JOB_PIPELINE } from "../../../lib/utils/constants";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import {
    checkOrgCreditBalance,
    deductCreditForInterview,
    canChargeForAIInterview,
} from "@/lib/utils/creditTransactions";


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

        const career = await db.collection("careers").findOne({ id: interview.id });

        if (!career) {
            return NextResponse.json({ error: "Career not found" }, { status: 404 });
        }

        const currentStage = getCurrentPipelineStage(career.pipelineStages || DEFAULT_JOB_PIPELINE, { status: interview.status, currentStep: interview.currentStep, stageId: interview.stageId, substageId: interview.substageId });
        const nextStage = getNextPipelineStage(career.pipelineStages || DEFAULT_JOB_PIPELINE, { stage: currentStage.stage.name, substage: currentStage.substage.name });

        if (!nextStage) {
            return NextResponse.json({ error: "No next stage found" }, { status: 400 });
        }

        // Credit check: If moving to AI Interview stage, verify credits
        // Skip credit operations for Premium job posts (unlimited AI interviews)
        const isMovingToAIInterview = nextStage.stage.name === "AI Interview";
        const orgId = career?.orgID;
        const isPremiumCareer = career?.jobPostType === "premium";

        if (isMovingToAIInterview && orgId) {
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
                return NextResponse.json(
                    { error: "No active plan found. Cannot move candidate to AI Interview. Please contact your administrator to assign a plan." },
                    { status: 402 }
                );
            }

            // Validate that the career's jobPostType matches an active plan
            if (isPremiumCareer && !hasActivePremiumPlan) {
                return NextResponse.json(
                    { error: "This job post is marked as Premium but the organization does not have an active Premium plan. Please update the job post type or assign a Premium plan." },
                    { status: 400 }
                );
            }

            if (!isPremiumCareer && career?.jobPostType === "credit-based" && !hasActiveCreditBasedPlan) {
                return NextResponse.json(
                    { error: "This job post is marked as Credit-based but the organization does not have an active Credit-based plan. Please update the job post type or assign a Credit-based plan." },
                    { status: 400 }
                );
            }

            // For credit-based careers and WITHOUT a premium plan, check credit balance
            if (!isPremiumCareer && !hasActivePremiumPlan && hasActiveCreditBasedPlan) {
                const creditStatus = await checkOrgCreditBalance(db, orgId);

                if (creditStatus.isInsufficient) {
                    return NextResponse.json(
                        { error: "Insufficient credits to move candidate to AI Interview. Contact us to purchase more credits." },
                        { status: 402 }
                    );
                }

                // Deduct credits if candidate should be charged
                if (canChargeForAIInterview(interview)) {
                    const deductResult = await deductCreditForInterview(db, orgId, interview, career);
                    if (!deductResult.success) {
                        return NextResponse.json(
                            { error: deductResult.error || "Failed to deduct credits" },
                            { status: 400 }
                        );
                    }
                }
            }
        }

        const update: any = {
            currentStep: nextStage.substage.currentStep,
            status: nextStage.substage.status,
            updatedAt: Date.now(),
            applicationMetadata: {
                updatedAt: Date.now(),
                updatedBy: {
                    image: user?.image,
                    name: user?.name,
                    email: user?.email,
                },
                action: "Endorsed",
            },
            stageId: nextStage.stage.id,
            substageId: nextStage.substage.id,
        }
        if (interview?.preScreeningAutoDrop?.status === "scheduled") {
            update.preScreeningAutoDrop = {
                ...interview.preScreeningAutoDrop,
                status: "cancelled",
                cancelledAt: new Date(),
                cancelledBy: "manual-endorse",
            };
        }

        // Set currentStepAlias for stages 1 and 2
        if (nextStage.stage.id === "1" || nextStage.stage.id === "2") {
            const stageAlias = career.pipelineStages?.find((s: any) => s.id === nextStage.stage.id)?.alias?.trim();
            if (stageAlias) {
                update.currentStepAlias = stageAlias;
            }
        }

        // Clear credit deferred flag if promoting a deferred candidate
        if (interview.creditDeferred && isMovingToAIInterview) {
            update.creditDeferred = false;
        }

        if (nextStage.substage.currentStep === "Contract Signed") {
            update.applicationStatus = "Hired";
        }

        const interviewTransaction = {
            interviewUID: interview._id.toString(),
            careerId: career._id.toString(),
            fromStage: `${currentStage.stage.name}: ${currentStage.substage.name}`,
            toStage: `${nextStage.stage.name}: ${nextStage.substage.name}`,
            fromStageId: currentStage.stage.id,
            fromSubstageId: currentStage.substage.id,
            toStageId: nextStage.stage.id,
            toSubstageId: nextStage.substage.id,
            action: "Endorsed",
            updatedBy: {
                image: user?.image,
                name: user?.name,
                email: user?.email,
            },
        };

        const updateOperation: any = { $set: { ...update } };
        
        // Clear currentStepAlias when moving to stages other than 1 or 2
        if (nextStage.stage.id !== "1" && nextStage.stage.id !== "2") {
            updateOperation.$unset = { currentStepAlias: "" };
        }

        const updateResult = await db.collection("interviews").updateOne(
            {
                _id: new ObjectId(uid),
                status: interview.status,
                currentStep: interview.currentStep
            },
            updateOperation
        );

        if (updateResult.matchedCount === 0) {
            return NextResponse.json(
                { error: "Candidate state has changed. They may have already been moved to the next stage by another recruiter." },
                { status: 409 }
            );
        }

        await db.collection("interview-history").insertOne({
            ...interviewTransaction,
            createdAt: Date.now(),
        });
        await db.collection("recruiter-history").insertOne({
            interviewUID: interview._id.toString(),
            orgID: interview.orgID,
            action: "Endorsed",
            recruiterEmail: user?.email,
            createdAt: Date.now(),
        });

        // Update career lastActivityAt to current date
        await db.collection("careers").updateOne(
            { id: interview.id },
            { $set: { lastActivityAt: new Date() } }
        );

        if (recruiterEvaluation) {
            const existingEvaluation = await db.collection("recruiter-evaluations").findOne({
                action: recruiterEvaluation.action,
                interviewUID: uid,
                stageId: nextStage?.stage?.id,
                substageId: nextStage?.substage?.id,
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
                    stageId: nextStage?.stage?.id,
                    substageId: nextStage?.substage?.id,
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

        return NextResponse.json({ message: "Candidate endorsed", updatedInterview: { ...interview, ...update } });
    } catch (error) {
        console.error("Error endorsing candidate:", error);
        return NextResponse.json({ error: "Failed to endorse candidate" }, { status: 500 });
    }
});
