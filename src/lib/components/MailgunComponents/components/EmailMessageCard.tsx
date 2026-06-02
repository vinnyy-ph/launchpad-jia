"use client";

import { useState, useEffect, useRef } from "react";
import {
  getFileExtension,
  formatFileSize,
  formatTimestamp,
  formatScheduledTime,
} from "@/lib/utils/emailCandidate";
import styles from "@/lib/components/MailgunComponents/email.module.scss";
import AvatarImage from "@/lib/components/AvatarImage/AvatarImage";
import Button from "@/lib/components/ui/button/Button";
import { useAppContext } from "@/lib/context/AppContext";
import { useApplicantAvatar } from "@/lib/hooks/useApplicantAvatar";
import { apiClient } from "@/lib/utils/apiClient";

type ThreadMessage = {
  id: string;
  senderName: string;
  senderEmail?: string;
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  timestamp?: string;
  subject?: string;
  content?: string; // HTML
  avatar?: string;
  isAutomated?: boolean;
  direction?: "inbound" | "outbound" | null;
  attachments?: Array<{
    fileName: string;
    fileSize: string | number;
    fileType: string;
    attachmentId?: string; // Outlook: Graph attachment id for download
  }>;
  scheduledSendDate?: string;
  scheduledId?: string;
  mode?: string | null; // "outlook" | "mailgun" | "gmail"
  outlookMessageId?: string | null;
  modeMessageId?: string | null;
};

export type Thread = {
  id: string;
  subject: string;
  stage?: string;
};

export default function EmailMessageCard({
  thread,
  messages,
  onCancelScheduled,
  outlookUserPicture,
  outlookEmail,
}: {
  thread: Thread;
  messages: ThreadMessage[];
  onCancelScheduled?: (scheduledId: string) => void;
  outlookUserPicture?: string | null;
  outlookEmail?: string | null;
}) {
  const { orgID } = useAppContext();

  // Download attachment handler (Outlook, Gmail, Mailgun)
  const handleDownloadAttachment = (att: any, msg?: ThreadMessage) => {
    if (!att) return;

    const outlookMessageId = msg?.outlookMessageId || msg?.modeMessageId;
    if (
      att.attachmentId &&
      outlookMessageId &&
      msg?.mode === "outlook" &&
      orgID
    ) {
      const filename = att.fileName || att.filename || att.name || "attachment";
      apiClient
        .get("/api/outlook/download-attachment", {
          params: {
            orgID,
            messageId: outlookMessageId,
            attachmentId: att.attachmentId,
            filename,
          },
          responseType: "blob",
        })
        .then((res) => {
          const blob = res.data as Blob;
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          window.URL.revokeObjectURL(url);
        })
        .catch((err) => {
          console.error("[EmailMessageCard] Outlook attachment download failed:", err);
        });
      return;
    }

    // Gmail: full URL (includes auth in query or cookie)
    if (att.url && att.url.includes("/api/gmail/download-attachment")) {
      const link = document.createElement("a");
      link.href = att.url;
      link.download = att.fileName || att.filename || "";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Mailgun: key or URL
    const url =
      att.url ||
      att.location ||
      att.r2Url ||
      att.objectUrl ||
      att.storageUrl ||
      att.link;
    const downloadId = att.key || url || null;
    if (!downloadId) {
      console.warn("EmailMessageCard: No key or URL found for attachment", att);
      return;
    }

    const filename = att.filename || att.name || att.fileName || null;
    const downloadUrl = filename
      ? `/api/mailgun-module/mg-download-attachment?id=${encodeURIComponent(downloadId)}&filename=${encodeURIComponent(filename)}`
      : `/api/mailgun-module/mg-download-attachment?id=${encodeURIComponent(downloadId)}`;

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename || "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(
    null,
  );
  const moreDetailsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const toggleMoreDetails = (messageId: string) => {
    setExpandedMessageId((prev) => (prev === messageId ? null : messageId));
  };

  // Close the more details modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (expandedMessageId) {
        const ref = moreDetailsRef.current.get(expandedMessageId);
        if (ref && !ref.contains(event.target as Node)) {
          setExpandedMessageId(null);
        }
      }
    };

    if (expandedMessageId) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [expandedMessageId]);

  const sorted = [...messages].sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return ta - tb;
  });

  return (
    <>
      {sorted.map((msg) => {
        return (
          <MessageItem
            key={msg.id}
            msg={msg}
            thread={thread}
            expandedMessageId={expandedMessageId}
            moreDetailsRef={moreDetailsRef}
            toggleMoreDetails={toggleMoreDetails}
            formatTimestamp={formatTimestamp}
            handleDownloadAttachment={handleDownloadAttachment}
            onCancelScheduled={onCancelScheduled}
            outlookUserPicture={outlookUserPicture}
            outlookEmail={outlookEmail}
          />
        );
      })}
    </>
  );
}

// Separate component for each message to properly use hooks
function MessageItem({
  msg,
  thread,
  expandedMessageId,
  moreDetailsRef,
  toggleMoreDetails,
  formatTimestamp,
  handleDownloadAttachment,
  onCancelScheduled,
  outlookUserPicture,
  outlookEmail,
}: {
  msg: ThreadMessage;
  thread: Thread;
  expandedMessageId: string | null;
  moreDetailsRef: React.MutableRefObject<Map<string, HTMLDivElement>>;
  toggleMoreDetails: (id: string) => void;
  formatTimestamp: (ts?: string) => string;
  handleDownloadAttachment: (att: any, msg?: ThreadMessage) => void;
  onCancelScheduled?: (scheduledId: string) => void;
  outlookUserPicture?: string | null;
  outlookEmail?: string | null;
}) {
  const { orgID } = useAppContext();
  // Fetch applicant avatar for this message's sender (now safe inside component)
  const { avatar: applicantAvatar } = useApplicantAvatar(msg.senderEmail, orgID);
  const isOutlookSender =
    outlookUserPicture &&
    outlookEmail &&
    msg.senderEmail &&
    String(msg.senderEmail).toLowerCase().trim() === String(outlookEmail).toLowerCase().trim();
  const displayAvatar =
    applicantAvatar ||
    (isOutlookSender ? outlookUserPicture : null) ||
    msg.avatar;

  return (
    <div
      key={msg.id}
      className={`${styles.messageCard} ${msg.direction === "inbound" ? styles.inbound : styles.outbound}`}
    >
      {/* Message Header */}
      <div className={styles.messageHeader}>
        {/* Left - Avatar and Profile Group */}
        <div className={styles.profileGroup}>
          <AvatarImage
            src={
              displayAvatar
                ? displayAvatar
                : `https://api.dicebear.com/9.x/glass/svg?seed=${msg.senderName}`
            }
            alt={msg.senderName}
          />
          <div className={styles.participantsGroup}>
            <div className={styles.senderWrapper}>
              <span className={styles.name}>{msg.senderName}</span>
              {msg.senderEmail && (
                <span className={styles.subtext}>
                  &lt;{msg.senderEmail}&gt;
                </span>
              )}
            </div>
            <div className={styles.receiverWrapper}>
              {msg.to && (
                <span className={styles.subtext}>
                  to {Array.isArray(msg.to) ? msg.to.join(", ") : msg.to}
                </span>
              )}
              <div
                className={styles.moreDetailsWrapper}
                ref={(el) => {
                  if (!el) {
                    moreDetailsRef.current.delete(msg.id);
                  } else {
                    moreDetailsRef.current.set(msg.id, el);
                  }
                }}
              >
                <img
                  className={styles.icon}
                  src="/icons/chevron-down.svg"
                  onClick={() => toggleMoreDetails(msg.id)}
                  style={{ cursor: "pointer" }}
                />
                {/* More Details Modal */}
                {expandedMessageId === msg.id && (
                  <div className={styles.moreDetailsModal}>
                    <div className={styles.detailRow}>
                      <span className={styles.label}>from:</span>
                      <span className={styles.value}>
                        <b>{msg.senderName}</b>{" "}
                        {msg.senderEmail && (
                          <span className={styles.subtext}>
                            &lt;{msg.senderEmail}&gt;
                          </span>
                        )}
                      </span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.label}>to:</span>
                      <span className={styles.value}>
                        {Array.isArray(msg.to)
                          ? msg.to.join(", ")
                          : typeof msg.to === "string"
                            ? msg.to
                            : ""}
                      </span>
                    </div>
                    {(() => {
                      const ccValue = Array.isArray(msg.cc)
                        ? msg.cc.join(", ")
                        : typeof msg.cc === "string"
                          ? msg.cc
                          : "";
                      return ccValue ? (
                        <div className={styles.detailRow}>
                          <span className={styles.label}>cc:</span>
                          <span className={styles.value}>{ccValue}</span>
                        </div>
                      ) : null;
                    })()}
                    {(() => {
                      const bccValue = Array.isArray(msg.bcc)
                        ? msg.bcc.join(", ")
                        : typeof msg.bcc === "string"
                          ? msg.bcc
                          : "";
                      return bccValue ? (
                        <div className={styles.detailRow}>
                          <span className={styles.label}>bcc:</span>
                          <span className={styles.value}>{bccValue}</span>
                        </div>
                      ) : null;
                    })()}
                    <div className={styles.detailRow}>
                      <span className={styles.label}>date:</span>
                      <span className={styles.value}>
                        {msg.timestamp
                          ? new Date(msg.timestamp).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.label}>subject:</span>
                      <span className={styles.value}>
                        {msg.subject || thread.subject}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right - Timestamp and Tag */}
        <div className={styles.timestampGroup}>
          <span className={styles.subtext}>
            {formatTimestamp(msg.timestamp)}
          </span>
          <div
            className={`${styles.badge} ${msg.isAutomated === true ? styles.automated : styles.direct}`}
          >
            <img
              src={
                msg.isAutomated === true
                  ? "/icons/zap-purple.svg"
                  : "/icons/user-orange.svg"
              }
            />
            {msg.isAutomated === true ? "Automated" : "Direct"}
          </div>
        </div>
      </div>

      {/* Scheduled: cancel button */}
      {msg.scheduledId && msg.scheduledSendDate && onCancelScheduled && (
        <div className={styles.scheduledGroup}>
          <img src="/iconsV2/scheduled.svg " alt="scheduled" />
          <span style={{ flex: 1 }}>
            Send scheduled for{" "}
            <b style={{ fontWeight: "500" }}>
              {formatScheduledTime(msg.scheduledSendDate)}
            </b>
          </span>
          <span
            className={styles.cancelSend}
            onClick={() => onCancelScheduled(msg.scheduledId!)}
          >
            Cancel send
          </span>
        </div>
      )}

      {/* Message Content */}
      <div
        className={styles.messageContent}
        ref={(el) => {
          if (el && msg.content) {
            // Wait for DOM update
            setTimeout(() => {
              const anchors = el.querySelectorAll("a");
              anchors.forEach((a) => {
                let href = a.getAttribute("href") || "";
                
                // Check if it's a redirect link (e.g., /api/link-redirect?url=...)
                if (href.includes("/api/link-redirect?url=")) {
                  try {
                    const url = new URL(href, window.location.origin);
                    const actualUrl = url.searchParams.get("url");
                    if (actualUrl) {
                      href = decodeURIComponent(actualUrl);
                    }
                  } catch (e) {
                    console.warn("Failed to parse redirect URL:", href);
                  }
                }
                
                // If href starts with //, add https:
                if (/^\/\//.test(href)) {
                  href = "https:" + href;
                }
                // If href is a bare domain (no protocol, no /, no mailto:), prepend https://
                if (
                  href &&
                  !/^https?:\/\//i.test(href) &&
                  !/^mailto:/i.test(href) &&
                  !href.startsWith("/")
                ) {
                  href = "https://" + href;
                }
                a.setAttribute("href", href);
                a.setAttribute("target", "_blank");
                a.setAttribute("rel", "noopener noreferrer");
              });
            }, 0);
          }
        }}
      >
        {msg.content ? (
          <div
            dangerouslySetInnerHTML={{ __html: msg.content }}
            style={{
              fontSize: "14px",
              color: "#181D27",
            }}
          />
        ) : null}
      </div>

      {/* Attachments */}
      {msg.attachments && msg.attachments.length > 0 && (
        <>
          <div className={styles.attachmentCount}>
            <img src="/icons/attachment.svg" />
            {msg.attachments.length} attachment
            {msg.attachments.length > 1 ? "s" : ""}
          </div>
          {msg.attachments.map((att, attIndex) => {
            if (!att || !att.fileName) return null;

            let ext =
              att.fileType &&
              att.fileType.length <= 5 &&
              !att.fileType.includes("/")
                ? att.fileType.toLowerCase()
                : getFileExtension(att.fileName);
            if (!ext) ext = "default";
            return (
              <div
                key={`${msg.id}-${attIndex}-${att.fileName}`}
                className={styles.attachmentContainer}
              >
                <img
                  className={styles.fileTypeIcon}
                  src={`/icons/fileTypes/${ext}.svg`}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      "/icons/fileTypes/default.svg";
                  }}
                />
                <div className={styles.attachmentInfo}>
                  <span className={styles.name}>{att.fileName}</span>
                  <span className={styles.size}>
                    {formatFileSize(att.fileSize)}
                  </span>
                </div>
                <Button
                  icon="/icons/download-cloud.svg"
                  label=""
                  variant="secondary"
                  style={{ width: 36, height: 36 }}
                  onClick={() => handleDownloadAttachment(att, msg)}
                />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
