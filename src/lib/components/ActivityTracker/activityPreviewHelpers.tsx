import styles from "./activityPreview.module.scss";

export interface ActivityData {
  _id: string;
  orgID: string;
  careerId?: string;
  candidateId?: string;
  interviewUID?: string;
  action: string;
  source?: string;
  actor?: {
    type?: string;
    id?: string;
    email?: string;
    name?: string;
    image?: string;
  };
  metadata?: Record<string, any>;
  occurredAt?: string | Date;
  createdAt?: string | Date;
}

// Helper: Format relative time
export function getRelativeTime(date: string | Date | undefined): string {
  if (!date) return "Just now";
  
  const eventDate = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - eventDate.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return eventDate.toLocaleDateString();
}

// Helper: Format full date
export function getFullDate(date: string | Date | undefined): string {
  if (!date) return "";
  
  const eventDate = typeof date === "string" ? new Date(date) : date;
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  
  return eventDate.toLocaleDateString("en-US", options);
}

// Helper: Parse comment text to clean up mentions
export function parseCommentMentions(text: string): string {
  if (!text) return "";
  
  // Replace @[Name](email) with @Name (with space)
  return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1 ');
}

// Helper: Determine badge style
export function getBadgeStyle(fit: string): string {
  const fitLower = fit.toLowerCase();
  if (fitLower.includes("strong")) return styles.strong;
  if (fitLower.includes("good")) return styles.good;
  if (fitLower.includes("maybe")) return styles.maybe;
  if (fitLower.includes("not fit")) return styles.bad;
  return styles.good;
}

// MIME to extension map for when filename has no extension (e.g. uploads with type only)
const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/tiff": "tiff",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/zip": "zip",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/json": "json",
  "video/mp4": "mp4",
  "audio/mpeg": "mp3",
};

const DEFAULT_FILE_ICON = "/icons/fileTypes/default.svg";

/**
 * Resolves the file type icon path for an uploaded file.
 * Uses filename extension (e.g. .png → png.svg) or mimeType; the actual icon is under public/icons/fileTypes/.
 * If the SVG for that type doesn’t exist, the img onError in the UI should fall back to default.svg.
 */
export function getFileTypeIconUrl(file: { filename?: string; mimeType?: string } | null | undefined): string {
  if (!file) return DEFAULT_FILE_ICON;
  let ext: string | null = null;
  if (file.filename) {
    const match = /\.([a-z0-9]+)$/i.exec(file.filename);
    if (match) ext = match[1].toLowerCase();
  }
  if (!ext && file.mimeType) {
    const mime = (file.mimeType || "").toLowerCase().split(";")[0].trim();
    ext = MIME_TO_EXT[mime] || null;
  }
  if (!ext) return DEFAULT_FILE_ICON;
  return `/icons/fileTypes/${ext}.svg`;
}

export { DEFAULT_FILE_ICON };

// Helper: Build trigger activity title
export function TriggerActivityTitle({ activity, actorName, applicantName, toStageName, matchFit }: any) {
  const action = String(activity.action || "").toLowerCase();
  const isAutomation = String(activity.source || "").toLowerCase() === "automation";
  
  const triggerVerb = action.includes("drop")
    ? isAutomation ? "auto-dropped" : "dropped"
    : action.includes("reconsider")
      ? "reconsidered"
      : action.includes("reset")
        ? "reset"
        : action.includes("endorse")
          ? isAutomation ? "auto-endorsed" : "endorsed"
          : activity.action;

  return (
    <span className={styles.previewTitle}>
      <b>{actorName}</b> {triggerVerb} <b>{applicantName}</b>{" "}
      {matchFit ? (
        <>
          as <span className={`${styles.badge} ${getBadgeStyle(matchFit)}`}>{matchFit}</span>{" "}
        </>
      ) : null}
      {action.includes("drop") ? "from" : "to the"}{" "}
      <span className={styles.highlight}>{toStageName}</span> stage
    </span>
  );
}

// Helper: Build applied activity title
export function AppliedActivityTitle({ applicantName, jobTitle, career }: any) {
  const careerName = jobTitle || career || "role";
  return (
    <span className={styles.previewTitle}>
      <b>{applicantName}</b> applied to the{" "}
      <span className={styles.highlight}>{careerName}</span> role
    </span>
  );
}

// Helper: Build withdrawn activity title
export function WithdrawnActivityTitle({ applicantName }: any) {
  return (
    <span className={styles.previewTitle}>
      <b>{applicantName}</b> withdrew their application
    </span>
  );
}

// Helper: Build submitted CV activity title
export function SubmittedCVTitle({ applicantName }: any) {
  return (
    <span className={styles.previewTitle}>
      <b>{applicantName}</b> submitted their CV
    </span>
  );
}

// Helper: Build AI interview completed activity title
export function AIInterviewCompletedTitle({ applicantName }: any) {
  return (
    <span className={styles.previewTitle}>
      <b>{applicantName}</b> completed the AI interview
    </span>
  );
}

// Helper: Build hired activity title
export function HiredActivityTitle({ applicantName, jobTitle, career }: any) {
  const careerName = jobTitle || career || "role";
  return (
    <span className={styles.previewTitle}>
      <b>{applicantName}</b> was hired for the <span className={styles.highlight}>{careerName}</span> role
    </span>
  );
}

// Helper: Build retake request activity title
export function RetakeRequestActivityTitle({ applicantName }: any) {
  return (
    <span className={styles.previewTitle}>
      <b>{applicantName}</b> requested to retake the AI Interview
    </span>
  );
}

// Helper: Build retake decision activity title
export function RetakeDecisionActivityTitle({ actorName, applicantName, decision }: any) {
  return (
    <span className={styles.previewTitle}>
      <b>{actorName}</b> {decision} <b>{applicantName}'s</b> AI interview retake request
    </span>
  );
}

// Helper: Build comment activity title
export function CommentActivityTitle({ actorName, applicantName, isReply, replyTo }: any) {
  if (isReply && replyTo) {
    return (
      <span className={styles.previewTitle}>
        <b>{actorName}</b> replied to <b>{replyTo}'s</b> comment on <b>{applicantName}'s</b> application
      </span>
    );
  }
  
  return (
    <span className={styles.previewTitle}>
      <b>{actorName}</b> commented on the application of <b>{applicantName}</b>
    </span>
  );
}

// Helper: Build attachment upload activity title
export function AttachmentUploadActivityTitle({ actorName, applicantName, stageName }: any) {
  return (
    <span className={styles.previewTitle}>
      <b>{actorName}</b> uploaded an attachment to <b>{applicantName}</b>'s application for the{" "}
      <span className={styles.highlight}>{stageName}</span> stage
    </span>
  );
}

// Helper: Build evaluation activity title
export function EvaluationActivityTitle({ actorName, applicantName, stageName, isUpdate, isDeleted }: any) {
  return (
    <span className={styles.previewTitle}>
      <b>{actorName}</b> {isDeleted ? "deleted" : isUpdate ? "updated" : "added"} an evaluation for <b>{applicantName}</b> in the{" "}
      <span className={styles.highlight}>{stageName}</span> stage
    </span>
  );
}

// Helper: Build invited candidate activity title
export function InvitedCandidateTitle({ actorName, applicantName, jobTitle, career }: any) {
  const careerName = jobTitle || career || "role";
  return (
    <span className={styles.previewTitle}>
      <b>{actorName}</b> invited <b>{applicantName}</b> to apply for the{" "}
      <span className={styles.highlight}>{careerName}</span> role
    </span>
  );
}

// Helper: Build shared externally activity title
export function SharedExternallyTitle({ actorName, applicantName }: any) {
  return (
    <span className={styles.previewTitle}>
      <b>{actorName}</b> shared <b>{applicantName}'s</b> profile externally
    </span>
  );
}

// Format multiple recipients for display (to, cc, bcc)
export function formatEmailedRecipients(
  recipients: Array<{ email: string; name?: string | null; type?: "to" | "cc" | "bcc" }>
): string {
  if (!recipients?.length) return "";
  const maxShow = 5;
  const parts = recipients.slice(0, maxShow).map((r) => {
    const display = r.name?.trim() || r.email || "";
    const type = (r.type || "to").toLowerCase();
    if (type === "to") return display;
    return `${display} (${type})`;
  });
  if (recipients.length <= maxShow) {
    return parts.length === 1 ? parts[0]! : parts.join(", ").replace(/, ([^,]+)$/, " and $1");
  }
  return `${parts.join(", ")} and ${recipients.length - maxShow} more`;
}

// Helper: Build emailed candidate activity title (supports multiple recipients: to, cc, bcc)
export function EmailedCandidateTitle({
  actorName,
  applicantName,
  emailSubject,
  recipients,
}: {
  actorName: string;
  applicantName: string;
  emailSubject?: string | null;
  recipients?: Array<{ email: string; name?: string | null; type?: "to" | "cc" | "bcc" }>;
}) {
  const recipientLabel =
    recipients?.length > 0 ? formatEmailedRecipients(recipients) : applicantName;
  return (
    <span className={styles.previewTitle}>
      <b>{actorName}</b> emailed <b>{recipientLabel}</b>
      {emailSubject && emailSubject !== "(no subject)" && (
        <>
          {" - "}
          <b>"{emailSubject}"</b>
        </>
      )}
    </span>
  );
}

// Helper: Build email automation activity title
export function EmailAutomationActivityTitle({ actorName, action, automationName, stageName }: any) {
  const actionLower = String(action || "").toLowerCase();
  const verb = actionLower.includes("created")
    ? "created"
    : actionLower.includes("updated")
      ? "updated"
      : actionLower.includes("deactivated")
        ? "deactivated"
        : actionLower.includes("deleted")
          ? "deleted"
          : "activated";

  return (
    <span className={styles.previewTitle}>
      <b>{actorName}</b> {verb} the <b>"{automationName || "Untitled"}"</b> email automation in{" "}
      <span className={styles.highlight}>{stageName || "selected"}</span> stage
    </span>
  );
}

// Helper: Build career details edited activity title
// Fields to hide from "what changed" (e.g. requisitionId often changes without user action)
const CAREER_CHANGED_FIELDS_SKIP = new Set(["requisitionId"]);

// Human-readable labels for career fields
const CAREER_FIELD_LABELS: Record<string, string> = {
  jobTitle: "Job title",
  description: "Description",
  questions: "Questions",
  status: "Published Status",
  screeningSetting: "Screening setting",
  requireVideo: "Require video",
  location: "Location",
  workSetup: "Work setup",
  workSetupRemarks: "Work setup remarks",
  minimumSalary: "Minimum salary",
  maximumSalary: "Maximum salary",
  salaryNegotiable: "Salary negotiable",
  province: "Province",
  city: "City",
  country: "Country",
  employmentType: "Employment type",
  preScreeningQuestions: "Pre-screening questions",
  pipelineStages: "Pipeline stages",
  teamMembers: "Team members",
  jobPostType: "Subscription Plan",
  walkthroughLanguage: "Walkthrough language",
  activityStatus: "Activity Status",
  requisitionId: "Requisition ID",
};

/**
 * Returns a list of human-readable changed field labels for "Edited Career Details".
 * Skips requisitionId (and any other noisy fields) by default.
 */
export function formatCareerChangedFields(
  changedFields: string[] | undefined | null
): string[] {
  if (!Array.isArray(changedFields) || changedFields.length === 0) return [];
  return changedFields
    .filter((f) => !CAREER_CHANGED_FIELDS_SKIP.has(f))
    .map((f) => CAREER_FIELD_LABELS[f] || f.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()))
    .filter(Boolean);
}

export function CareerEditedDetailsTitle({ actorName, jobTitle }: any) {
  return (
    <span className={styles.previewTitle}>
      <b>{actorName}</b> updated the <span className={styles.highlight}>{jobTitle || "career"}</span> career details
    </span>
  );
}

// Helper: Build career status updated activity title
export function CareerStatusUpdatedTitle({ actorName, jobTitle, newStatus }: any) {
  return (
    <span className={styles.previewTitle}>
      <b>{actorName}</b> changed the <span className={styles.highlight}>{jobTitle || "career"}</span> career status to <b>{newStatus}</b>
    </span>
  );
}

// Helper: Build career published activity title
export function CareerPublishedTitle({ actorName, jobTitle }: any) {
  return (
    <span className={styles.previewTitle}>
      <b>{actorName}</b> published the <span className={styles.highlight}>{jobTitle || "career"}</span> career
    </span>
  );
}

// Helper: Build career unpublished activity title
export function CareerUnpublishedTitle({ actorName, jobTitle }: any) {
  return (
    <span className={styles.previewTitle}>
      <b>{actorName}</b> unpublished the <span className={styles.highlight}>{jobTitle || "career"}</span> career
    </span>
  );
}

// Helper: Build updated activity status title
export function CareerActivityStatusUpdatedTitle({
  actorName,
  jobTitle,
  newStatus,
}: {
  actorName: string;
  jobTitle?: string;
  newStatus?: string;
}) {
  return (
    <span className={styles.previewTitle}>
      <b>{actorName}</b> updated the Activity Status for{" "}
      <span className={styles.highlight}>{jobTitle || "career"}</span> to{" "}
      <b>{newStatus ?? "—"}</b>
    </span>
  );
}

// Helper: Build updated subscription plan title
export function CareerSubscriptionPlanUpdatedTitle({
  actorName,
  jobTitle,
  newPlan,
}: {
  actorName: string;
  jobTitle?: string;
  newPlan?: string;
}) {
  const planLabel =
    newPlan === "credit-based"
      ? "Credit-based"
      : newPlan === "premium"
        ? "Premium"
        : newPlan ?? "—";
  return (
    <span className={styles.previewTitle}>
      <b>{actorName}</b> updated the Subscription Plan for{" "}
      <span className={styles.highlight}>{jobTitle || "career"}</span> to{" "}
      <b>{planLabel}</b>
    </span>
  );
}

// Helper: Build career deleted activity title
export function CareerDeletedTitle({ actorName, jobTitle }: any) {
  return (
    <span className={styles.previewTitle}>
      <b>{actorName}</b> deleted the <span className={styles.highlight}>{jobTitle || "career"}</span> career
    </span>
  );
}

// Helper: Determine activity type
export function getActivityType(activity: ActivityData, activityType: string) {
  const action = String(activity.action || "").toLowerCase();
  const isTrigger =
    activityType === "trigger" ||
    action.includes("endorse") ||
    action.includes("drop") ||
    action.includes("reconsider") ||
    action.includes("reset") ||
    String(activity.source || "").toLowerCase() === "automation";
  const isApplied = action.includes("applied");
  const isWithdrawn = action.includes("cancel") || action.includes("withdraw");
  const isSubmittedCV = action.includes("submitted cv");
  const isAIInterviewCompleted = action.includes("completed ai interview");
  const isHired = action === "hired";
  const isRetakeRequested = action.includes("requested ai interview retake");
  const isRetakeDecision = action.includes("approved ai interview retake") || action.includes("rejected ai interview retake");
  const isComment = action.includes("commented on application");
  const isAttachmentUpload = action.includes("uploaded attachment");
  const isEvaluation =
    action.includes("added evaluation") ||
    action.includes("updated evaluation") ||
    action.includes("deleted evaluation");
  const isInvited = action.includes("invited candidate");
  const isSharedExternally = action.includes("shared externally");
  const isEmailedCandidate = action.includes("emailed candidate");
  const isEmailAutomationManagement =
    action.includes("created email automation") ||
    action.includes("updated email automation") ||
    action.includes("activated email automation") ||
    action.includes("deactivated email automation") ||
    action.includes("deleted email automation");
  const isCareerEditedDetails = action.includes("edited career details");
  const isCareerStatusUpdated = action.includes("updated career status");
  // Check unpublished before published: "unpublished career" contains "published career"
  const isCareerUnpublished = action.includes("unpublished career");
  const isCareerPublished =
    action.includes("published career") && !isCareerUnpublished;
  const isCareerDeleted = action.includes("deleted career");
  const isCareerActivityStatusUpdated = action.includes("updated activity status");
  const isCareerSubscriptionPlanUpdated = action.includes("updated subscription plan");

  return {
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
  };
}
