"use client";

import React, { useState } from "react";
import EmailEditor, { MailgunAccount } from "./EmailEditor";

interface ComposeEmailModuleProps {
  isOpen: boolean;
  onClose: () => void;
  applicantEmail?: string;
  careerIds?: string[];
  replyData?: {
    to: string;
    subject: string;
    threadId?: string;
    originalEmail?: any;
    isReply?: boolean;
    isForward?: boolean;
  };
  onSync?: () => void;
  mailgunAccounts?: MailgunAccount[];
  mailgunRole?: string | null;
  selectedMailgunAccountId?: string | null;
}

export default function ComposeEmailModule({
  isOpen,
  onClose,
  applicantEmail,
  careerIds,
  replyData,
  onSync,
  mailgunAccounts,
  mailgunRole,
  selectedMailgunAccountId,
}: ComposeEmailModuleProps) {
  const [composeMode, setComposeMode] = useState<
    "minimized" | "window" | "fullscreen"
  >("window");

  // To field: prefer applicantEmail (trimmed), else fallback to replyData?.to
  const resolvedInitialTo = (() => {
    try {
      if (applicantEmail && String(applicantEmail).trim())
        return String(applicantEmail).trim();
      const rdTo = replyData?.to;
      if (Array.isArray(rdTo)) return rdTo.join(", ");
      if (rdTo && String(rdTo).trim()) return String(rdTo).trim();
      return undefined;
    } catch (e) {
      return undefined;
    }
  })();

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className={`compose-email-modal compose-email-modal-overlay ${
        composeMode === "fullscreen" && "fullscreen"
      }`}
    >
      <div
        className={`modal ${composeMode === "fullscreen" && "fullscreen"} ${
          composeMode === "minimized" && "minimized"
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{ display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div
          className="header"
          onClick={() => {
            composeMode === "minimized"
              ? setComposeMode("window")
              : composeMode === "fullscreen"
              ? setComposeMode("window")
              : setComposeMode("minimized");
          }}
          style={{ flexShrink: 0 }}
        >
          <div className="header-left">
            <i
              className="la la-envelope"
              style={{ fontSize: "18px", color: "#6c757d" }}
            ></i>
            <h3 className="header-title">
              {replyData?.isForward
                ? "Forward Email"
                : replyData?.isReply
                ? "Reply to Email"
                : "Compose Email"}
            </h3>
          </div>
          <div className="window-controls">
            <button
              className="window-control-button"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                setComposeMode((prev) =>
                  prev === "minimized" ? "window" : "minimized"
                );
              }}
            >
              <i className="las la-minus"></i>
            </button>
            <button
              className="window-control-button"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                setComposeMode((prev) =>
                  prev === "minimized"
                    ? "fullscreen"
                    : prev === "fullscreen"
                    ? "window"
                    : "fullscreen"
                );
              }}
            >
              {composeMode === "fullscreen" ? (
                <i className="las la-compress-arrows-alt"></i>
              ) : (
                <i className="las la-expand-arrows-alt"></i>
              )}
            </button>
            <button
              className="window-control-button"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <i className="las la-times"></i>
            </button>
          </div>
        </div>
        <div
          style={{
            padding: 24,
            overflow: "auto",
            display: composeMode === "minimized" ? "none" : "block",
            maxHeight:
              composeMode === "fullscreen"
                ? "calc(100vh - 60px)"
                : "calc(100vh - 120px)",
          }}
        >
          <EmailEditor
            initialTo={resolvedInitialTo}
            initialSubject={replyData?.subject}
            initialCareerId={replyData?.originalEmail?.careerId || undefined}
            threadId={replyData?.threadId || null}
            initialMessage={
              replyData?.originalEmail?.text ||
              replyData?.originalEmail?.html ||
              undefined
            }
            inReplyTo={
              replyData?.isReply
                ? replyData?.originalEmail?.mailgunMessageIdRaw ||
                  replyData?.originalEmail?.mailgunMessageId ||
                  undefined
                : undefined
            }
            draftId={replyData?.originalEmail?._id}
            isDraft={
              replyData?.originalEmail?._id
                ? replyData?.originalEmail?.isDraft ||
                  replyData?.originalEmail?.is_draft ||
                  replyData?.originalEmail?.draft ||
                  (typeof replyData?.originalEmail?.status === "string" &&
                    replyData.originalEmail.status.toLowerCase() === "draft") ||
                  (typeof replyData?.originalEmail?.direction === "string" &&
                    replyData.originalEmail.direction.toLowerCase() ===
                      "draft") ||
                  undefined
                : undefined
            }
            initialAttachments={
              replyData?.originalEmail?.draftAttachments ||
              replyData?.originalEmail?.attachments ||
              undefined
            }
            careerIds={
              careerIds && Array.isArray(careerIds) && careerIds.length > 0
                ? careerIds
                : replyData?.originalEmail?.careerId
                ? [String(replyData.originalEmail.careerId)]
                : undefined
            }
            onSync={() => {
              try {
                if (typeof onSync === "function") return onSync();
              } catch (e) {}
              try {
                if (typeof window !== "undefined")
                  window.dispatchEvent(new CustomEvent("mailgun:sync-request"));
              } catch (e) {}
            }}
            onClose={onClose}
            prefetchedAccounts={mailgunAccounts}
            prefetchedRole={mailgunRole}
            prefetchedSelectedAccountId={selectedMailgunAccountId}
          />
        </div>
      </div>
    </div>
  );
}
