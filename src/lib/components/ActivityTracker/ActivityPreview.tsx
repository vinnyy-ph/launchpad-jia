"use client";

import React, { useState } from "react";
import styles from "./activityPreview.module.scss";
import AvatarImage from "../AvatarImage/AvatarImage";
import {
  ActivityData,
  getRelativeTime,
  getFullDate,
  parseCommentMentions,
  getBadgeStyle,
  TriggerActivityTitle,
  AppliedActivityTitle,
  WithdrawnActivityTitle,
  SubmittedCVTitle,
  AIInterviewCompletedTitle,
  HiredActivityTitle,
  RetakeRequestActivityTitle,
  RetakeDecisionActivityTitle,
  CommentActivityTitle,
  AttachmentUploadActivityTitle,
  EvaluationActivityTitle,
  InvitedCandidateTitle,
  SharedExternallyTitle,
  EmailedCandidateTitle,
  EmailAutomationActivityTitle,
  formatCareerChangedFields,
  CareerEditedDetailsTitle,
  CareerStatusUpdatedTitle,
  CareerPublishedTitle,
  CareerUnpublishedTitle,
  CareerActivityStatusUpdatedTitle,
  CareerSubscriptionPlanUpdatedTitle,
  CareerDeletedTitle,
  getActivityType,
  getFileTypeIconUrl,
  DEFAULT_FILE_ICON,
} from "./activityPreviewHelpers";

interface ActivityPreviewProps {
  career?: string;
  candidate?: string;
  activityType?: "default" | "trigger" | "comment" | "file";
  isLast?: boolean;
  activity?: ActivityData;
}

export default function ActivityPreview({
  career,
  candidate,
  activityType = "default",
  isLast = false,
  activity,
}: ActivityPreviewProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!activity) {
    return null;
  }

  // Real activity data
  const hasRecordedActor = Boolean(
    activity.actor?.id || activity.actor?.email || activity.actor?.name,
  );
  const actorName = hasRecordedActor
    ? activity.actor?.name || activity.actor?.email || "Jia"
    : "Jia";
  const actorImage = hasRecordedActor
    ? activity.actor?.image ||
      activity.metadata?.actorImage ||
      activity.metadata?.actor?.image
    : undefined;
  const actorAvatarSrc =
    typeof actorImage === "string" && actorImage.trim()
      ? actorImage
      : "/jia-dashboard-logo.png";

  const applicantName =
    activity.metadata?.applicant?.name ||
    activity.metadata?.applicant?.email ||
    "Candidate";
  const toStageName =
    activity.metadata?.toStageName ||
    activity.metadata?.toStage ||
    "Next Stage";
  const jobTitle = activity.metadata?.jobTitle || career;
  const matchFit =
    typeof activity.metadata?.matchFit === "string"
      ? activity.metadata.matchFit.trim()
      : "";

  const occurredTime = getRelativeTime(activity.occurredAt);
  const fullDate = getFullDate(activity.occurredAt);
  const {
    isTrigger,
    isApplied,
    isWithdrawn,
    isSubmittedCV,
    isAIInterviewCompleted,
    isHired,
    isRetakeRequested,
    isRetakeDecision,
    isComment,
    isAttachmentUpload,
    isEvaluation,
    isInvited,
    isSharedExternally,
    isEmailedCandidate,
    isEmailAutomationManagement,
    isCareerEditedDetails,
    isCareerStatusUpdated,
    isCareerPublished,
    isCareerUnpublished,
    isCareerActivityStatusUpdated,
    isCareerSubscriptionPlanUpdated,
    isCareerDeleted,
  } = getActivityType(activity, activityType);

  return (
    <div className={styles.previewContainer}>
      {/* Avatar */}
      <div className={styles.previewAvatarGroup}>
        <AvatarImage src={actorAvatarSrc} />
        {!isLast && <div className={styles.previewConnector} />}
      </div>

      {/* Content */}
      <div className={styles.previewContent}>
        {/* Title */}
        {isTrigger ? (
          <TriggerActivityTitle
            activity={activity}
            actorName={actorName}
            applicantName={applicantName}
            toStageName={toStageName}
            matchFit={matchFit}
          />
        ) : isWithdrawn ? (
          <WithdrawnActivityTitle applicantName={applicantName} />
        ) : isSubmittedCV ? (
          <SubmittedCVTitle applicantName={applicantName} />
        ) : isAIInterviewCompleted ? (
          <AIInterviewCompletedTitle applicantName={applicantName} />
        ) : isHired ? (
          <HiredActivityTitle
            applicantName={applicantName}
            jobTitle={jobTitle}
            career={career}
          />
        ) : isRetakeRequested ? (
          <RetakeRequestActivityTitle applicantName={applicantName} />
        ) : isRetakeDecision ? (
          <RetakeDecisionActivityTitle
            actorName={actorName}
            applicantName={applicantName}
            decision={
              activity.metadata?.decision === "approved"
                ? "approved"
                : "rejected"
            }
          />
        ) : isComment ? (
          <CommentActivityTitle
            actorName={actorName}
            applicantName={applicantName}
            isReply={activity.metadata?.isReply}
            replyTo={activity.metadata?.replyTo}
          />
        ) : isAttachmentUpload ? (
          <AttachmentUploadActivityTitle
            actorName={actorName}
            applicantName={applicantName}
            stageName={activity.metadata?.stageName || "a stage"}
          />
        ) : isEvaluation ? (
          <EvaluationActivityTitle
            actorName={actorName}
            applicantName={applicantName}
            stageName={activity.metadata?.stageName || "a stage"}
            isUpdate={activity.metadata?.isUpdate || false}
            isDeleted={activity.metadata?.isDeleted || false}
          />
        ) : isInvited ? (
          <InvitedCandidateTitle
            actorName={actorName}
            applicantName={applicantName}
            jobTitle={jobTitle}
            career={career}
          />
        ) : isSharedExternally ? (
          <SharedExternallyTitle
            actorName={actorName}
            applicantName={applicantName}
          />
        ) : isEmailedCandidate ? (
          <EmailedCandidateTitle
            actorName={actorName}
            applicantName={applicantName}
            emailSubject={activity.metadata?.emailSubject}
            recipients={activity.metadata?.recipients}
          />
        ) : isEmailAutomationManagement ? (
          <EmailAutomationActivityTitle
            actorName={actorName}
            action={activity.action}
            automationName={activity.metadata?.automationName}
            stageName={activity.metadata?.stageName}
          />
        ) : isCareerEditedDetails ? (
          <>
            <CareerEditedDetailsTitle
              actorName={actorName}
              jobTitle={jobTitle}
            />
            {(() => {
              const changed = formatCareerChangedFields(activity.metadata?.changedFields);
              return changed.length > 0 ? (
                <div className={styles.changedFieldsPreview}>
                  Changed: {changed.join(", ")}
                </div>
              ) : null;
            })()}
          </>
        ) : isCareerStatusUpdated ? (
          <CareerStatusUpdatedTitle
            actorName={actorName}
            jobTitle={jobTitle}
            newStatus={activity.metadata?.newStatus}
          />
        ) : isCareerPublished ? (
          <CareerPublishedTitle
            actorName={actorName}
            jobTitle={jobTitle}
          />
        ) : isCareerUnpublished ? (
          <CareerUnpublishedTitle
            actorName={actorName}
            jobTitle={jobTitle}
          />
        ) : isCareerActivityStatusUpdated ? (
          <CareerActivityStatusUpdatedTitle
            actorName={actorName}
            jobTitle={jobTitle}
            newStatus={activity.metadata?.newStatus}
          />
        ) : isCareerSubscriptionPlanUpdated ? (
          <CareerSubscriptionPlanUpdatedTitle
            actorName={actorName}
            jobTitle={jobTitle}
            newPlan={activity.metadata?.newPlan}
          />
        ) : isCareerDeleted ? (
          <CareerDeletedTitle
            actorName={actorName}
            jobTitle={jobTitle}
          />
        ) : isApplied ? (
          <AppliedActivityTitle
            applicantName={applicantName}
            jobTitle={jobTitle}
            career={career}
          />
        ) : (
          <span className={styles.previewTitle}>
            {activity.metadata?.message || activity.action}
          </span>
        )}

        {/* Comment */}
        {activity.metadata?.comment && (
          <div className={styles.commentPreview}>
            "{parseCommentMentions(activity.metadata.comment)}"
          </div>
        )}

        {/* File Attachment */}
        {activity.metadata?.file?.filename && (
          <div className={styles.filePreview}>
            <img
              src={getFileTypeIconUrl(activity.metadata.file)}
              alt="file"
              width="40"
              height="40"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_FILE_ICON;
              }}
            />
            <div className={styles.fileInfo}>
              <span className={styles.fileName}>
                {activity.metadata.file.filename}
              </span>
              <span className={styles.fileMeta}>
                {activity.metadata.file.size
                  ? `${(activity.metadata.file.size / 1024 / 1024).toFixed(2)} MB`
                  : ""}
              </span>
            </div>
          </div>
        )}

        {/* Evaluation Notes */}
        {activity.metadata?.evaluationNotes && !isEvaluation && (
          <div className={styles.commentPreview}>
            "{activity.metadata.evaluationNotes}"
          </div>
        )}

        {/* Meta */}
        <div className={styles.previewMeta}>
          <div
            className={styles.timestampWrapper}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <span>{occurredTime}</span>
            {showTooltip && <div className={styles.tooltip}>{fullDate}</div>}
          </div>
          {candidate && (
            <>
              <span>•</span>
              <span>{jobTitle || candidate}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
