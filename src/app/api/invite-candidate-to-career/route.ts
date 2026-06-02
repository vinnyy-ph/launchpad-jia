import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { guid, getFirstEnabledStage } from "@/lib/Utils";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { DEFAULT_JOB_PIPELINE } from "@/lib/utils/constants";
import { ObjectId } from "mongodb";
import {
  canInviteAndGetSource,
  extractTransferableFields,
  CareerHierarchyInfo,
  isChildCareer
} from "@/lib/utils/careerHierarchy";
import { sendEmailV2 } from "@/lib/utils/emailAutomation";
import { logActivity } from "@/lib/utils/activityLogger";

interface InviteRequest {
  sourceInterviewId?: string;
  targetCareerIds: string[];
  candidateEmail: string;
  invitedBy: {
    name: string;
    email: string;
    image: string;
  };
  sourceCareerIdOverride?: string;
  orgID?: string;
  emailContent?: {
    subject: string;
    body: string;
  };
  /** When true, force data transfer from source interview regardless of hierarchy rules */
  forceTransfer?: boolean;
  automationIdsToUse?: string[];
  /** Optional target stage/substage for drag-and-drop placement */
  targetStageId?: string;
  targetSubstageId?: string;
}

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const {
      sourceInterviewId,
      targetCareerIds,
      candidateEmail,
      invitedBy,
      sourceCareerIdOverride,
      orgID: providedOrgID,
      forceTransfer,
      automationIdsToUse,
      targetStageId,
      targetSubstageId,
    }: InviteRequest = (await request.json()) as InviteRequest;

    if (!targetCareerIds?.length || !candidateEmail || !invitedBy) {
      console.error("[invite-candidate-to-career] Missing required data: targetCareerIds, candidateEmail, or invitedBy");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    // If no source interview, we MUST have an orgID to know context
    if (!sourceInterviewId && !providedOrgID) {
      console.error("[invite-candidate-to-career] Missing required data: sourceInterviewId or providedOrgID");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    let sourceInterview: any = null;
    let sourceCareer: any = null;

    // Only fetch source interview if ID is provided
    if (sourceInterviewId) {
      sourceInterview = await db.collection("interviews").findOne({
        _id: new ObjectId(sourceInterviewId),
      });

      if (!sourceInterview) {
        return NextResponse.json(
          { error: "Source interview not found" },
          { status: 404 }
        );
      }

      // Fetch source career for parent-child hierarchy info
      const effectiveSourceCareerId = sourceCareerIdOverride || sourceInterview.id;
      sourceCareer = await db.collection("careers").findOne({
        id: effectiveSourceCareerId,
      });

      if (!sourceCareer) {
        return NextResponse.json(
          { error: "Source career not found" },
          { status: 404 }
        );
      }
    } else {
      // No source interview? We need to get basic candidate details from affiliation
      // because we don't have an interview to copy name/image from.
      const affiliation = await db.collection("affiliations").findOne({
        "applicantInfo.email": candidateEmail,
        orgID: providedOrgID
      });

      if (!affiliation) {
        return NextResponse.json(
          { error: "Candidate not found in this organization" },
          { status: 404 }
        );
      }

      // Mock a minimal source interview structure for downstream usage
      sourceInterview = {
        name: affiliation.applicantInfo.name,
        image: affiliation.applicantInfo.image,
        // ID and other fields remain undefined/null
      };
    }

    const sourceCareerInfo: CareerHierarchyInfo = {
      id: sourceCareer?.id || "external", // Fallback for hierarchy check
      parentCareerID: sourceCareer?.parentCareerID || null,
      careerPostType: sourceCareer?.careerPostType,
      pipelineStages: sourceCareer?.pipelineStages,
    };

    const created: { careerId: string; careerTitle: string; interviewId: string }[] = [];
    const skipped: { careerId: string; careerTitle: string; reason: string }[] = [];
    const blocked: { careerId: string; careerTitle: string; reason: string }[] = [];
    const newDate = new Date();

    for (const targetCareerId of targetCareerIds) {
      const targetCareer = await db.collection("careers").findOne({
        _id: new ObjectId(targetCareerId),
      });

      if (!targetCareer) {
        skipped.push({
          careerId: targetCareerId,
          careerTitle: "Unknown",
          reason: "Career not found",
        });
        continue;
      }

      // Check parent-child invite permissions
      const targetCareerInfo: CareerHierarchyInfo = {
        id: targetCareer.id,
        parentCareerID: targetCareer.parentCareerID || null,
        careerPostType: targetCareer.careerPostType,
        pipelineStages: targetCareer.pipelineStages,
      };

      // If we have a source career, check hierarchy. 
      // If NOT (spreadsheet import), we allow the invite (treat as external/fresh invite).
      let invitePermission: any = { allowed: true, transfer: false };

      if (sourceCareerIdOverride || sourceInterviewId) {
        invitePermission = canInviteAndGetSource(sourceCareerInfo, targetCareerInfo);

        if (!invitePermission.allowed) {
          blocked.push({
            careerId: targetCareerId,
            careerTitle: targetCareer.jobTitle,
            reason: invitePermission.reason || "Invite not allowed based on job hierarchy",
          });
          continue;
        }
      }

      const existingInterview = await db.collection("interviews").findOne({
        id: targetCareer.id,
        email: candidateEmail,
      });

      if (existingInterview) {
        skipped.push({
          careerId: targetCareerId,
          careerTitle: targetCareer.jobTitle,
          reason: "Already exists",
        });
        continue;
      }

      const pipelineStages = targetCareer.pipelineStages || DEFAULT_JOB_PIPELINE;
      const firstEnabled = getFirstEnabledStage(pipelineStages);

      if (!firstEnabled) {
        skipped.push({
          careerId: targetCareerId,
          careerTitle: targetCareer.jobTitle,
          reason: "No enabled stages",
        });
        continue;
      }

      // Resolve placement: use target stage from drag-and-drop if provided, fallback to first enabled
      let placement = firstEnabled;
      if (targetStageId && targetSubstageId) {
        const tStage = pipelineStages.find((s: any) => s.id === targetStageId);
        const tSub = tStage?.substages?.find((s: any) => s.id === targetSubstageId);
        if (tStage && tSub) {
          placement = { stage: tStage, substage: tSub };
        }
      }

      // Determine data transfer based on target career type
      // Rule: Transfer data only when target is a CHILD career (has parentCareerID)
      // Source is always the source interview
      let transferData: Record<string, any> = {};
      let statusDate: Record<string, any> = {};
      let dataTransferredFromId: string | null = null;

      // Check if we should transfer: target must be a child career AND we have source data
      const targetIsChild = isChildCareer({
        id: targetCareer.id,
        parentCareerID: targetCareer.parentCareerID,
        careerPostType: targetCareer.careerPostType,
        pipelineStages: targetCareer.pipelineStages,
      });
      const shouldTransfer = targetIsChild && sourceInterview && sourceInterviewId && 
        (forceTransfer || invitePermission.transfer);

      if (shouldTransfer) {
        // Transfer from source interview
        transferData = extractTransferableFields(sourceInterview);
        dataTransferredFromId = sourceInterview.id || null;

        // Also transfer stateClass if present
        if (sourceInterview.stateClass !== undefined) {
          transferData.stateClass = sourceInterview.stateClass;
        }

        // Transfer status dates
        if (sourceInterview.statusDate?.["CV Screening"]) {
          statusDate["CV Screening"] = sourceInterview.statusDate["CV Screening"];
        }
        if (sourceInterview.statusDate?.["AI Interview"]) {
          statusDate["AI Interview"] = sourceInterview.statusDate["AI Interview"];
        }

        // Transfer inherited interview metadata
        if (sourceInterview.completedAt !== undefined) {
          transferData.inheritedCompletedAt = sourceInterview.completedAt;
        }
        if (sourceInterview.interviewDuration !== undefined) {
          transferData.inheritedInterviewDuration = sourceInterview.interviewDuration;
        }
      }
      // If target is parent/end-to-end, no transfer (fresh start)

      const newInterviewData: Record<string, any> = {
        jobTitle: targetCareer.jobTitle,
        headcount: targetCareer.headcount,
        description: targetCareer.description,
        questions: targetCareer.questions,
        location: targetCareer.location,
        workSetup: targetCareer.workSetup,
        screeningSetting: targetCareer.screeningSetting,
        orgID: targetCareer.orgID,
        requisitionId: targetCareer.requisitionId,
        requireVideo: targetCareer.requireVideo,
        salaryNegotiable: targetCareer.salaryNegotiable,
        minimumSalary: targetCareer.minimumSalary,
        maximumSalary: targetCareer.maximumSalary,
        country: targetCareer.country,
        province: targetCareer.province,
        employmentType: targetCareer.employmentType,
        preScreeningQuestions: (() => {
          // Merge selectedAnswers from source interview into target career's pre-screening questions
          if (sourceInterview?.preScreeningQuestions?.length > 0 && targetCareer.preScreeningQuestions?.length > 0) {
            const sourceAnswersMap = new Map(
              sourceInterview.preScreeningQuestions
                .filter((q: any) => q.selectedAnswers?.length > 0)
                .map((q: any) => [q.id, q.selectedAnswers])
            );
            return targetCareer.preScreeningQuestions.map((targetQ: any) => {
              const sourceAnswers = sourceAnswersMap.get(targetQ.id);
              return sourceAnswers ? { ...targetQ, selectedAnswers: sourceAnswers } : targetQ;
            });
          }
          return targetCareer.preScreeningQuestions;
        })(),
        pipelineStages: targetCareer.pipelineStages,
        id: targetCareer.id,

        email: candidateEmail,
        name: sourceInterview.name,
        image: sourceInterview.image,

        ...transferData,
        ...(Object.keys(statusDate).length > 0 ? { statusDate } : {}),

        applicationStatus: "Ongoing",
        currentStep: placement.substage.currentStep,
        status: placement.substage.status,
        stageId: placement.stage.id,
        substageId: placement.substage.id,
        createdAt: newDate,
        updatedAt: newDate,
        interviewID: guid(),
        completedAt: null,
        reviewers: [],

        invitedFrom: {
          interviewId: sourceInterviewId || null,
          careerId: sourceCareer?.id || null,
          careerTitle: sourceCareer?.jobTitle || "External Import",
          invitedAt: newDate,
          invitedBy: invitedBy,
          dataTransferredFrom: dataTransferredFromId,
        },
      };

      const insertResult = await db.collection("interviews").insertOne(newInterviewData);
      const newInterviewId = insertResult.insertedId.toString();

      await db.collection("interview-history").insertOne({
        interviewUID: newInterviewId,
        careerId: targetCareer._id.toString(),
        action: "Invited",
        toStage: `${placement.stage.name}: ${placement.substage.name}`,
        toStageId: placement.stage.id,
        toSubstageId: placement.substage.id,
        invitedFrom: {
          interviewId: sourceInterviewId,
          careerId: sourceInterview.id,
          careerTitle: sourceInterview.jobTitle,
        },
        updatedBy: invitedBy,
        createdAt: Date.now(),
      });

      // Transfer recruiter evaluations for core stages (CV Screening and AI Interview)
      if (shouldTransfer && sourceInterviewId) {
        const sourceEvaluations = await db.collection("recruiter-evaluations")
          .find({
            interviewUID: sourceInterviewId,
            stageId: { $in: ["1", "2"] }, // CV Screening and AI Interview
          })
          .toArray();

        if (sourceEvaluations.length > 0) {
          const copiedEvaluations = sourceEvaluations.map((evaluation: any) => {
            const { _id, ...evalWithoutId } = evaluation;
            return {
              ...evalWithoutId,
              interviewUID: newInterviewId,
              inheritedFrom: {
                interviewUID: sourceInterviewId,
                evaluationId: _id,
                copiedAt: newDate,
              },
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
          });

          await db.collection("recruiter-evaluations").insertMany(copiedEvaluations);
        }
      }

      await db.collection("careers").updateOne(
        { _id: new ObjectId(targetCareerId) },
        { $set: { lastActivityAt: newDate } }
      );

      created.push({
        careerId: targetCareerId,
        careerTitle: targetCareer.jobTitle,
        interviewId: newInterviewId,
      });

      // Log activity for the invitation
      try {
        // Fetch member profile for actor details
        const member = await db.collection("members").findOne({
          email: invitedBy.email,
          orgID: targetCareer.orgID,
        });

        // Fetch the newly created interview for complete data
        const createdInterview = await db.collection("interviews").findOne({
          _id: new ObjectId(newInterviewId),
        });

        await logActivity({
          db,
          kind: "recruiter_invited_candidate",
          interview: createdInterview,
          career: targetCareer,
          actor: {
            type: "recruiter",
            id: member?.uid || member?._id?.toString(),
            email: invitedBy.email,
            name: invitedBy.name,
            image: member?.image || member?.photoURL || invitedBy.image,
          },
        });
      } catch (logError) {
        console.error("Error logging invitation activity:", logError);
        // Don't fail the invitation if logging fails
      }

      // Trigger email automations for the invite action
      // "Invited" automations are stored with stage_id: "invited" — query by trigger directly
      sendEmailV2({
        stage_id: "invited",
        substage_id: "invited",
        trigger_on_event: "Invited",
        from_stage: null,
        to_stage: `Invited: Invited`,
        orgID: targetCareer.orgID,
        careerId: targetCareer._id.toString(),
        email: candidateEmail,
        userId: request.user?.id,
        automationIdsToUse,
      });

      await db.collection("recruiter-history").insertOne({
        interviewUID: newInterviewId,
        orgID: targetCareer.orgID,
        action: "Invited to Career",
        recruiterEmail: invitedBy?.email,
        createdAt: Date.now(),
      });
    }

    if (created.length > 0) {
      // Invitation complete — no additional email call needed here.
      // The per-career sendEmailV2 above already handles Invited automations.
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      blocked,
    });
  } catch (error: any) {
    console.error("Error inviting candidate to career:", error);
    return NextResponse.json(
      {
        error: "Failed to invite candidate",
        details: error.message,
      },
      { status: 500 }
    );
  }
});

