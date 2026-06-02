"use client";

import styles from "@/lib/components/MailgunComponents/email.module.scss";
import AvatarImage from "@/lib/components/AvatarImage/AvatarImage";
import { useMemo } from "react";
import { useAppContext } from "@/lib/context/AppContext";
import { useApplicantInfo } from "@/lib/hooks/useApplicantInfo";
import { useApplicantAvatar } from "@/lib/hooks/useApplicantAvatar";
import { useInterviewStage } from "@/lib/hooks/useInterviewStage";
import {
  getRelativeTime,
  isThreadUnread,
  cleanEmailSubject,
  cleanEmailContentForPreview,
} from "@/lib/utils/emailCandidate";

export type ThreadMessage = {
  id: string;
  threadId?: string;
  senderName: string;
  senderEmail?: string;
  receiverName?: string;
  receiverEmail?: string;
  to?: string | string[];
  timestamp?: string;
  date?: string; // Gmail field
  subject?: string;
  content?: string; // HTML
  snippet?: string; // Gmail field
  avatar?: string;
  isAutomated?: boolean;
  direction?: "inbound" | "outbound" | null;
  readBy?: string[];
  attachments?: Array<{ fileName: string; fileSize: string; fileType: string }>;
  isDraft?: boolean;
};

export type Thread = {
  id: string;
  subject: string;
  stage?: string;
  careerId?: string; // career UUID
  careerTitle?: string; // job title
  isUnread?: boolean;
  readMap?: Record<string, string>;
  isDraft?: boolean;
};

// Skeleton loader for EmailPreviewCard
export function EmailPreviewCardSkeleton() {
  return (
    <div className={styles.previewCard} style={{ opacity: 0.7 }}>
      <div
        className={styles.skeletonAvatar}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "#e0e0e0",
          marginRight: 12,
        }}
      />
      <div className={styles.previewContent}>
        <div className={styles.previewText}>
          <div className={styles.previewHeader}>
            <div className={styles.senderGroup}>
              <span
                className={styles.skeletonBox}
                style={{
                  width: 80,
                  height: 16,
                }}
              />
              <div
                className={styles.skeletonBox}
                style={{
                  width: 60,
                  height: 16,
                  marginLeft: 8,
                }}
              />
            </div>
            <div className={styles.timestampGroup}>
              <span
                className={styles.skeletonBox}
                style={{
                  width: 40,
                  height: 12,
                }}
              />
            </div>
          </div>
          <span
            className={styles.skeletonBox}
            style={{
              width: 120,
              height: 14,
              margin: "8px 0",
            }}
          />
          <span
            className={styles.skeletonBox}
            style={{
              width: 180,
              height: 12,
            }}
          />
        </div>
        <div className={styles.previewBadges}>
          <div className={styles.left}>
            <div
              className={styles.skeletonBox}
              style={{
                width: 50,
                height: 14,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmailPreviewCard({
  thread,
  messages,
  isActive = false,
  isScheduled = false,
  optimisticReadAt,
  onSelect,
  outlookUserPicture,
  outlookEmail,
}: {
  thread: Thread;
  messages: ThreadMessage[];
  isActive?: boolean;
  isScheduled?: boolean;
  optimisticReadAt?: string; // ISO timestamp when thread was optimistically marked as read
  onSelect?: (id: string) => void;
  outlookUserPicture?: string | null;
  outlookEmail?: string | null;
}) {
  const { orgID, user } = useAppContext();

  // Determine applicant email from thread messages
  const applicantInfo = useApplicantInfo(messages);

  // Fetch interview stage for the applicant
  const { stage: applicantStage } = useInterviewStage(
    applicantInfo.email,
    thread.careerId,
    orgID,
  );

  const sorted = [...messages].sort((a, b) => {
    // Handle both timestamp and date fields for Gmail/Mailgun compatibility
    const ta =
      a.timestamp || a.date ? new Date(a.timestamp || a.date!).getTime() : 0;
    const tb =
      b.timestamp || b.date ? new Date(b.timestamp || b.date!).getTime() : 0;
    return ta - tb;
  });

  const last = sorted[sorted.length - 1] || messages[0];
  const first = sorted[0] || messages[0]; // First message for original subject

  // Fetch applicant avatar from collections (use last sender's email)
  const { avatar: applicantAvatar } = useApplicantAvatar(last?.senderEmail, orgID);
  // Use Outlook user picture from email-settings when last sender is the connected Outlook account
  const isOutlookSender =
    outlookUserPicture &&
    outlookEmail &&
    last?.senderEmail &&
    String(last.senderEmail).toLowerCase().trim() === String(outlookEmail).toLowerCase().trim();
  const avatarSrc =
    applicantAvatar ||
    (isOutlookSender ? outlookUserPicture : null) ||
    last?.avatar ||
    `https://api.dicebear.com/9.x/glass/svg?seed=${last?.senderName || "Email"}`;
  const hasDraft = messages.some((msg) => msg.isDraft) || thread.isDraft;

  // Determine if thread is unread based on readBy status, readMap, and optimistic updates
  const isUnread = useMemo(() => {
    return isThreadUnread(
      thread,
      messages,
      user?.email,
      user?.uid,
      optimisticReadAt,
    );
  }, [thread, messages, user?.email, user?.uid, optimisticReadAt]);
  // Count attachments from all messages in the thread
  const attachmentCount = messages.reduce((total, msg) => {
    return total + (msg?.attachments?.length || 0);
  }, 0);

  return (
    <div
      className={`${styles.previewCard} ${isActive ? styles.active : ""} ${
        isUnread ? styles.unread : ""
      }`}
      tabIndex={0}
      onMouseDown={(e) => (e.currentTarget as HTMLDivElement).focus()}
      onClick={() => onSelect && onSelect(thread.id)}
    >
      <AvatarImage
        src={avatarSrc}
        alt={last?.senderName || "Email"}
        style={{ width: 32, height: 32 }}
      />
      <div className={styles.previewContent}>
        <div className={styles.previewText}>
          <div className={styles.previewHeader}>
            <div className={styles.senderGroup}>
              <span
                className={styles.senderName}
                style={{ color: hasDraft ? "#b42318" : "" }}
              >
                {hasDraft
                  ? "Draft"
                  : last?.senderName || last?.senderEmail || ""}
              </span>
              {thread.careerId && (
                <div
                  className={styles.badge}
                  style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "inline-block",
                  }}
                >
                  {thread.careerTitle}
                </div>
              )}
            </div>
            <div className={styles.timestampGroup}>
              {isUnread && !isScheduled && (
                <span className={styles.unreadBadge} aria-label="Unread" />
              )}
              <span className={styles.timestamp}>
                {last?.timestamp || last?.date
                  ? getRelativeTime(last.timestamp || last.date!)
                  : ""}
              </span>
            </div>
          </div>
          <span
            className={styles.previewSubject}
            style={{ fontWeight: isUnread && !isScheduled ? 600 : 400 }}
          >
            {(hasDraft
              ? cleanEmailSubject(thread.subject || last?.subject || "")
              : cleanEmailContentForPreview(
                  thread.subject || last?.subject || "",
                )) || "(no subject)"}
          </span>
          <span className={styles.previewSnippet}>
            {(hasDraft
              ? cleanEmailSubject(last?.content || last?.snippet || "")
              : cleanEmailContentForPreview(
                  last?.content || last?.snippet || "",
                )) || "(no message)"}
          </span>
        </div>
        <div className={styles.previewBadges}>
          <div className={styles.left}>
            {applicantStage && (
              <div className={`${styles.badge} ${styles.transparent}`}>
                {applicantStage}
              </div>
            )}
            {messages.length > 1 && (
              <div className={`${styles.badge} ${styles.transparent}`}>
                {messages.length} messages
              </div>
            )}
          </div>
          {attachmentCount > 0 && (
            <div className={styles.badge}>
              <img src="/icons/attachment.svg" alt="attachment" />
              {attachmentCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
