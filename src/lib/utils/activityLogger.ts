import { Db, ObjectId } from "mongodb";
import { recordActivityHistory } from "@/lib/utils/activityHistoryHelpers";

type ActivityKind =
  | "candidate_applied"
  | "candidate_withdrew"
  | "candidate_submitted_cv"
  | "candidate_completed_ai_interview"
  | "candidate_hired"
  | "candidate_requested_ai_interview_retake"
  | "recruiter_reviewed_ai_interview_retake"
  | "recruiter_commented_on_application"
  | "recruiter_uploaded_attachment"
  | "recruiter_added_evaluation"
  | "recruiter_invited_candidate"
  | "recruiter_shared_externally"
  | "recruiter_emailed_candidate"
  | "system_endorsed"
  | "recruiter_endorsed"
  | "recruiter_dropped"
  | "recruiter_reconsidered"
  | "recruiter_reset"
  | "recruiter_created_email_automation"
  | "recruiter_updated_email_automation"
  | "recruiter_activated_email_automation"
  | "recruiter_deactivated_email_automation"
  | "recruiter_deleted_email_automation"
  | "recruiter_edited_career_details"
  | "recruiter_updated_career_status"
  | "recruiter_published_career"
  | "recruiter_unpublished_career"
  | "recruiter_updated_activity_status"
  | "recruiter_updated_subscription_plan"
  | "recruiter_deleted_career";

type ActorInfo = {
  type: "candidate" | "recruiter" | "system";
  id?: string;
  email?: string;
  name?: string;
  image?: string;
};

type LogActivityInput = {
  db: Db;
  kind: ActivityKind;
  interview?: any;
  career?: any;
  orgID?: string;
  careerId?: string;
  actor?: ActorInfo;
  extraMetadata?: Record<string, any>;
};

/**
 * Resolves jobTitle from interview or career data with fallbacks
 */
function resolveJobTitle(interview: any, career: any): string | null {
  return (
    interview?.jobTitle ||
    career?.jobTitle ||
    career?.title ||
    career?.name ||
    null
  );
}

/**
 * Normalizes core interview identifiers
 */
function normalizeIds(interview: any) {
  return {
    applicantId: interview?.candidateId || interview?._id?.toString(),
    interviewUID: interview?._id?.toString(),
  };
}

/**
 * Builds standardized applicant metadata
 */
function buildApplicantMetadata(interview: any, ids: any) {
  return {
    id: ids.applicantId,
    interviewUID: ids.interviewUID,
    name: interview?.name || null,
    email: interview?.email || null,
    image: interview?.image || interview?.profileImage || interview?.photoURL || null,
  };
}

/**
 * Centralized activity logger - prevents duplication and ensures consistency
 */
export async function logActivity({
  db,
  kind,
  interview,
  career: careerInput,
  orgID,
  careerId,
  actor = { type: "system" as const, name: "Jia" },
  extraMetadata = {},
}: LogActivityInput) {
  const isAutomationManagementKind =
    kind === "recruiter_created_email_automation" ||
    kind === "recruiter_updated_email_automation" ||
    kind === "recruiter_activated_email_automation" ||
    kind === "recruiter_deactivated_email_automation" ||
    kind === "recruiter_deleted_email_automation";

  const isCareerManagementKind =
    kind === "recruiter_edited_career_details" ||
    kind === "recruiter_updated_career_status" ||
    kind === "recruiter_published_career" ||
    kind === "recruiter_unpublished_career" ||
    kind === "recruiter_updated_activity_status" ||
    kind === "recruiter_updated_subscription_plan" ||
    kind === "recruiter_deleted_career";

  if (!interview && !isAutomationManagementKind && !isCareerManagementKind) {
    console.warn("logActivity: interview data missing");
    return;
  }

  // Fetch career if not provided
  const career =
    careerInput ||
    (careerId
      ? await db.collection("careers").findOne({
          $or: [
            ...(ObjectId.isValid(careerId) ? [{ _id: new ObjectId(careerId) }] : []),
            { id: careerId },
          ],
        })
      : await db.collection("careers").findOne({ id: interview?.id }));

  const ids = normalizeIds(interview || {});
  let applicantMetadata = buildApplicantMetadata(interview, ids);
  // For emailed-candidate, resolve applicant name from another application in org if missing
  if (kind === "recruiter_emailed_candidate" && !applicantMetadata?.name && applicantMetadata?.email) {
    const orgIdForLookup = orgID || interview?.orgID || career?.orgID;
    if (orgIdForLookup) {
      const other = await db.collection("interviews").findOne(
        {
          $or: [
            { orgID: orgIdForLookup },
            ...(ObjectId.isValid(String(orgIdForLookup)) ? [{ orgID: new ObjectId(String(orgIdForLookup)) }] : []),
          ],
          email: applicantMetadata.email,
        },
        { projection: { name: 1 } }
      );
      if (other?.name) applicantMetadata = { ...applicantMetadata, name: other.name };
    }
  }
  const jobTitle = resolveJobTitle(interview, career);
  const candidateName = interview?.name || applicantMetadata?.name || actor?.name || "Candidate";
  const actorName = actor?.name || "Jia";

  // When actor is candidate/applicant, use applicant id and image from interview so activity has correct actor details
  const isCandidateActor = actor?.type === "candidate" || kind.startsWith("candidate_");
  const candidateActorDetails =
    interview && isCandidateActor
      ? {
          id: ids.applicantId || actor?.id,
          email: interview?.email || actor?.email,
          image:
            interview?.image ||
            interview?.profileImage ||
            interview?.photoURL ||
            actor?.image,
        }
      : {};

  // Use career._id for activity-history so ActivityTracker (which fetches by career._id) matches
  const basePayload = {
    orgID: orgID || interview?.orgID || career?.orgID,
    careerId: careerId || career?._id?.toString() || career?.id,
    candidateId: ids.applicantId,
    interviewUID: ids.interviewUID,
    actor: {
      type: actor?.type || "system",
      id: actor?.id,
      email: actor?.email,
      name: actorName,
      image: actor?.image,
      ...(Object.keys(candidateActorDetails).length ? candidateActorDetails : {}),
    },
    metadata: {
      applicant: applicantMetadata,
      jobTitle,
      ...extraMetadata,
    },
    occurredAt: new Date(),
  };

  try {
    switch (kind) {
      case "candidate_applied": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Applied",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "candidate",
            name: candidateName,
          },
          metadata: {
            ...basePayload.metadata,
            message: `${candidateName} applied to the ${jobTitle || "role"}`,
          },
        });
      }

      case "candidate_withdrew": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Cancelled",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "candidate",
            name: candidateName,
          },
          metadata: {
            ...basePayload.metadata,
            message: `${candidateName} withdrew their application`,
          },
        });
      }

      case "candidate_submitted_cv": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Submitted CV",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "candidate",
            name: candidateName,
          },
          metadata: {
            ...basePayload.metadata,
            message: `${candidateName} submitted their CV`,
          },
        });
      }

      case "candidate_completed_ai_interview": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Completed AI Interview",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "candidate",
            name: candidateName,
          },
          metadata: {
            ...basePayload.metadata,
            message: `${candidateName} completed the AI interview`,
          },
        });
      }

      case "candidate_hired": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Hired",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "candidate",
            name: candidateName,
          },
          metadata: {
            ...basePayload.metadata,
            message: `${candidateName} was hired for the ${jobTitle || "role"} role`,
          },
        });
      }

      case "candidate_requested_ai_interview_retake": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Requested AI Interview Retake",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "candidate",
            name: candidateName,
          },
          metadata: {
            ...basePayload.metadata,
            message: `${candidateName} requested to retake the AI Interview`,
          },
        });
      }

      case "recruiter_reviewed_ai_interview_retake": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: extraMetadata?.decision === "approved" ? "Approved AI Interview Retake" : "Rejected AI Interview Retake",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            message: `${actorName} ${extraMetadata?.decision === "approved" ? "approved" : "rejected"} ${candidateName}'s AI interview retake request`,
            decision: extraMetadata?.decision,
          },
        });
      }

      case "recruiter_commented_on_application": {
        const isReply = extraMetadata?.isReply;
        const replyToName = extraMetadata?.replyTo;
        const message = isReply && replyToName
          ? `${actorName} replied to ${replyToName}'s comment on ${candidateName}'s application`
          : `${actorName} commented on the application of ${candidateName}`;
        
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Commented on Application",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            message,
            comment: extraMetadata?.comment || null,
            isReply: isReply || false,
            replyTo: replyToName || null,
          },
        });
      }

      case "recruiter_uploaded_attachment": {
        const stageName = extraMetadata?.stageName || "a stage";
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Uploaded Attachment",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            message: `${actorName} uploaded an attachment to ${candidateName}'s application for the ${stageName} stage`,
            stageName,
            file: {
              filename: extraMetadata?.filename || null,
              mimeType: extraMetadata?.mimeType || null,
              size: extraMetadata?.size || null,
              url: extraMetadata?.url || null,
            },
          },
        });
      }

      case "recruiter_added_evaluation": {
        const stageName = extraMetadata?.stageName || "a stage";
        const isUpdate = extraMetadata?.isUpdate || false;
        const isDeleted = extraMetadata?.isDeleted || false;
        return recordActivityHistory(db, {
          ...basePayload,
          action: isDeleted
            ? "Deleted Evaluation"
            : isUpdate
              ? "Updated Evaluation"
              : "Added Evaluation",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            message: `${actorName} ${isDeleted ? "deleted" : isUpdate ? "updated" : "added"} an evaluation for ${candidateName} in the ${stageName} stage`,
            stageName,
            matchFit: extraMetadata?.matchFit || null,
            evaluationNotes: extraMetadata?.evaluationNotes || null,
            isUpdate,
            isDeleted,
          },
        });
      }

      case "recruiter_invited_candidate": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Invited Candidate",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            message: `${actorName} invited ${candidateName} to apply for the ${jobTitle || "role"} role`,
          },
        });
      }

      case "recruiter_shared_externally": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Shared Externally",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            message: `${actorName} shared ${candidateName}'s profile externally`,
          },
        });
      }

      case "recruiter_emailed_candidate": {
        const emailSubject = extraMetadata?.emailSubject || "(no subject)";
        const recipients = extraMetadata?.recipients as
          | Array<{ email: string; name?: string | null; type?: "to" | "cc" | "bcc" }>
          | undefined;
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Emailed Candidate",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            message: `${actorName} emailed ${candidateName}`,
            emailSubject,
            ...(Array.isArray(recipients) && recipients.length > 0 && { recipients }),
          },
        });
      }

      case "system_endorsed": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Endorsed",
          source: "automation",
          actor: {
            ...basePayload.actor,
            type: "system",
            name: "Jia",
          },
          metadata: {
            ...basePayload.metadata,
            message: extraMetadata?.message || `Jia auto-endorsed ${candidateName}`,
            ...extraMetadata,
          },
        });
      }

      case "recruiter_endorsed": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Endorsed",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            ...extraMetadata,
          },
        });
      }

      case "recruiter_dropped": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Dropped",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            ...extraMetadata,
          },
        });
      }

      case "recruiter_reconsidered": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Reconsidered",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            ...extraMetadata,
          },
        });
      }

      case "recruiter_reset": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Reset",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            ...extraMetadata,
          },
        });
      }

      case "recruiter_created_email_automation": {
        const stageName = extraMetadata?.stageName || "selected";
        const automationName = extraMetadata?.automationName || "Untitled";
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Created Email Automation",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            stageName,
            automationName,
            message: `${actorName} created the \"${automationName}\" email automation in ${stageName} stage`,
          },
        });
      }

      case "recruiter_updated_email_automation": {
        const stageName = extraMetadata?.stageName || "selected";
        const automationName = extraMetadata?.automationName || "Untitled";
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Updated Email Automation",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            stageName,
            automationName,
            message: `${actorName} updated the \"${automationName}\" email automation in ${stageName} stage`,
          },
        });
      }

      case "recruiter_activated_email_automation": {
        const stageName = extraMetadata?.stageName || "selected";
        const automationName = extraMetadata?.automationName || "Untitled";
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Activated Email Automation",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            stageName,
            automationName,
            message: `${actorName} activated the \"${automationName}\" email automation in ${stageName} stage`,
          },
        });
      }

      case "recruiter_deactivated_email_automation": {
        const stageName = extraMetadata?.stageName || "selected";
        const automationName = extraMetadata?.automationName || "Untitled";
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Deactivated Email Automation",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            stageName,
            automationName,
            message: `${actorName} deactivated the \"${automationName}\" email automation in ${stageName} stage`,
          },
        });
      }

      case "recruiter_deleted_email_automation": {
        const stageName = extraMetadata?.stageName || "selected";
        const automationName = extraMetadata?.automationName || "Untitled";
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Deleted Email Automation",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            stageName,
            automationName,
            message: `${actorName} deleted the \"${automationName}\" email automation in ${stageName} stage`,
          },
        });
      }

      case "recruiter_edited_career_details": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Edited Career Details",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            message: `${actorName} updated the ${jobTitle || "career"} career details`,
            changedFields: extraMetadata?.changedFields || [],
          },
        });
      }

      case "recruiter_updated_career_status": {
        const newStatus = extraMetadata?.newStatus || "unknown";
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Updated Career Status",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            message: `${actorName} changed the ${jobTitle || "career"} career status to ${newStatus}`,
            newStatus,
            previousStatus: extraMetadata?.previousStatus || null,
          },
        });
      }

      case "recruiter_published_career": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Published Career",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            message: `${actorName} published the ${jobTitle || "career"} career`,
          },
        });
      }

      case "recruiter_unpublished_career": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Unpublished Career",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            message: `${actorName} unpublished the ${jobTitle || "career"} career`,
          },
        });
      }

      case "recruiter_updated_activity_status": {
        const newActivityStatus = extraMetadata?.newStatus ?? "—";
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Updated Activity Status",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            message: `${actorName} updated the Activity Status for ${jobTitle || "career"} to ${newActivityStatus}`,
            newStatus: newActivityStatus,
          },
        });
      }

      case "recruiter_updated_subscription_plan": {
        const newPlan = extraMetadata?.newPlan ?? "—";
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Updated Subscription Plan",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            message: `${actorName} updated the Subscription Plan for ${jobTitle || "career"} to ${newPlan}`,
            newPlan,
          },
        });
      }

      case "recruiter_deleted_career": {
        return recordActivityHistory(db, {
          ...basePayload,
          action: "Deleted Career",
          source: "manual",
          actor: {
            ...basePayload.actor,
            type: "recruiter",
          },
          metadata: {
            ...basePayload.metadata,
            message: `${actorName} deleted the ${jobTitle || "career"} career`,
          },
        });
      }

      default:
        console.warn(`logActivity: unknown kind "${kind}"`);
        return;
    }
  } catch (error) {
    console.error(`Failed to record activity (${kind}):`, error);
  }
}
