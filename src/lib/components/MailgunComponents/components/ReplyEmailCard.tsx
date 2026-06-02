import React, { useState, useEffect, useMemo, useRef } from "react";
import { useEmailDraft } from "@/lib/hooks/useEmailDraft";
import { useAppContext } from "@/lib/context/AppContext";
import { useEmailData } from "@/lib/hooks/useEmailData";
import { useEmailAttachments } from "@/lib/hooks/useEmailAttachments";
import { useEmailSending } from "@/lib/hooks/useEmailSending";
import styles from "@/lib/components/MailgunComponents/email.module.scss";
import AvatarImage from "@/lib/components/AvatarImage/AvatarImage";
import Button from "@/lib/components/ui/button/Button";
import attachmentStyles from "@/lib/components/MailgunComponents/editor/editor.module.scss";
import RichTextToolbar from "@/lib/components/MailgunComponents/editor/RichTextToolbar";
import EmailToolbar from "@/lib/components/MailgunComponents/editor/EmailToolbar";
import TokenEditorField, {
  TokenEditorHandle,
} from "@/lib/components/MailgunComponents/editor/TokenEditorField";
import AutocompleteField from "@/lib/components/MailgunComponents/editor/AutocompleteField";
import {
  extractEmailFromString,
  handleDiscardEmail,
  saveEditorSelectionForLinkModal,
  insertLinkInEditor,
  filterSenderOptionsByRole,
} from "@/lib/utils/emailCandidate";
import { errorToast, successToast } from "@/lib/Utils";
import { apiClient } from "@/lib/utils/apiClient";
import { useEmailSignature } from "@/lib/hooks/useEmailSignature";
import { formatReplySubject } from "@/lib/utils/emailCandidate";
import type { AutocompleteOption } from "@/lib/components/MailgunComponents/editor/AutocompleteField";
import ScheduleSendModal, {
  type ScheduleEmailPayload,
} from "./ScheduleSendModal";

interface SenderOption {
  value: string;
  imageSrc?: string;
  label: string;
  email?: string;
  userId?: string;
}

export type ReplyInitialDraft = {
  _id?: string;
  html?: string;
  text?: string;
  draftAttachments?: any[];
  [key: string]: any;
};

interface ReplyEmailCardProps {
  threadId?: string;
  messages?: any[];
  thread?: any;
  onReplySuccess?: () => void;
  onClose?: () => void;
  onScheduled?: () => void;
  defaultRecipient?: string;
  initialDraft?: ReplyInitialDraft | null;
  initialBody?: string;
  onDraftDeleted?: () => void;
}

const ReplyEmailCard = ({
  threadId,
  messages = [],
  thread,
  onReplySuccess,
  onClose,
  onScheduled,
  defaultRecipient,
  initialDraft,
  initialBody = "",
  onDraftDeleted,
}: ReplyEmailCardProps) => {
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [showScheduleButton, setShowScheduleButton] = useState(false);
  const [isScheduleSendModalOpen, setIsScheduleSendModalOpen] = useState(false);
  const { user, orgID } = useAppContext();
  const [fromSender, setFromSender] = useState<SenderOption[]>([]);
  const savedRangeRef = useRef<Range | null>(null);
  const receiverRef = useRef<HTMLDivElement | null>(null);
  const draftIdRef = useRef<string | null>(null);
  const hasPrefilledFromDraftRef = useRef(false);
  const hasPrefilledCcBccRef = useRef(false);

  // Use combined email data hook
  const {
    senderOptions,
    gmailEmails,
    outlookEmails,
    defaultSender,
    recipientOptions,
    isRecipientsLoading,
    userEmails,
    matchRecipientsFromEmails,
    currentOrgRole,
  } = useEmailData(orgID);

  // Filter sender options based on user role (currentOrgRole from activeOrg is source of truth)
  const filteredSenderOptions = filterSenderOptionsByRole(
    senderOptions,
    user?.email,
    user?._id,
    user?.roles,
    user?.orgRoles,
    orgID,
    currentOrgRole,
  );

  // Use shared attachment hook (prefill from draft when opening reply draft)
  const draftAttachments = initialDraft?.draftAttachments ?? (initialDraft as any)?.attachments;
  const {
    attachments,
    setAttachmentsFromDraft,
    fileInputRef,
    handleAttachmentClick,
    handleAttachmentChange,
    removeAttachment,
    clearAttachments,
    formatAttachmentsForPayload,
  } = useEmailAttachments(draftAttachments);

  // Sync attachments when opening a reply draft (by draft id)
  useEffect(() => {
    const list = initialDraft?.draftAttachments ?? (initialDraft as any)?.attachments;
    setAttachmentsFromDraft(list ?? []);
  }, [initialDraft?._id, setAttachmentsFromDraft]);

  // Use shared email sending hook
  const { isSending, sendEmail } = useEmailSending();

  useEffect(() => {
    if (defaultSender && defaultSender.length > 0 && fromSender.length === 0) {
      setFromSender(
        defaultSender.map((sender: any) => ({
          ...sender,
          value: sender.value || sender.email || sender.label || "",
          label:
            typeof sender.label === "string"
              ? sender.label
              : typeof sender.email === "string"
                ? sender.email
                : "",
        })),
      );
    }
  }, [defaultSender, fromSender.length]);

  // Derive default recipients from the thread's messages (participants)
  // Match them to recipientOptions so they're properly selected
  const defaultRecipients = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    if (!matchRecipientsFromEmails || !userEmails) return [];

    // Collect unique participant emails from messages
    const participantEmails = new Set<string>();

    messages.forEach((msg: any) => {
      // Add sender as a potential recipient (for replies)
      if (msg?.senderEmail) {
        const email = msg.senderEmail.toLowerCase();
        if (!userEmails.has(email)) {
          participantEmails.add(email);
        }
      }

      // Also check 'to' recipients for multi-party threads
      const toList = Array.isArray(msg?.to)
        ? msg.to
        : typeof msg?.to === "string"
          ? [msg.to]
          : [];
      toList.forEach((recipient: string) => {
        const email = extractEmailFromString(recipient)?.toLowerCase();
        if (email && !userEmails.has(email)) {
          participantEmails.add(email);
        }
      });
    });

    // Match participant emails to recipientOptions
    try {
      return matchRecipientsFromEmails(Array.from(participantEmails));
    } catch (error) {
      console.error("Error matching recipients:", error);
      return [];
    }
  }, [messages, userEmails, matchRecipientsFromEmails]);

  const [toRecipients, setToRecipients] = useState<any[]>([]);

  // Update toRecipients when defaultRecipients change (only if not loading)
  useEffect(() => {
    if (!isRecipientsLoading && defaultRecipients.length > 0) {
      setToRecipients(defaultRecipients);
    }
  }, [defaultRecipients, isRecipientsLoading]);

  // Set default recipient if provided and no recipients are set yet
  useEffect(() => {
    if (
      defaultRecipient &&
      toRecipients.length === 0 &&
      recipientOptions.length > 0
    ) {
      const matchedRecipient = recipientOptions.find(
        (opt) => opt.value?.toLowerCase() === defaultRecipient.toLowerCase(),
      );
      if (matchedRecipient) {
        setToRecipients([matchedRecipient]);
      }
    }
  }, [defaultRecipient, recipientOptions]);

  const [ccRecipients, setCcRecipients] = useState<AutocompleteOption[]>([]);
  const [bccRecipients, setBccRecipients] = useState<AutocompleteOption[]>([]);
  const [showRecipientUI, setShowRecipientUI] = useState(false);
  const [formData, setFormData] = useState({
    email_subject: "",
    email_body: initialBody || "",
  });
  const [activeEditorId, setActiveEditorId] = useState<string | null>(null);

  // Editor refs
  const bodyEditorRef = useRef<TokenEditorHandle>(null);
  const subjectEditorRef = useRef<TokenEditorHandle>(null);

  // Fetch signature and add to body on initial load
  useEmailSignature({
    fromSender,
    orgID,
    user,
    currentBody: formData.email_body,
    setBody: (body) => setFormData((prev) => ({ ...prev, email_body: body })),
    bodyEditorRef,
  });

  // Get the reply subject (add "Re:" prefix if not already present)
  const replySubject = useMemo(() => {
    const originalSubject = thread?.subject || messages[0]?.subject || "";
    return formatReplySubject(originalSubject);
  }, [thread?.subject, messages]);

  // Get the last message's mailgunMessageId for In-Reply-To header
  const inReplyToMessageId = useMemo(() => {
    if (!messages || messages.length === 0) return null;
    // Sort messages by timestamp to get the most recent one
    const sortedMessages = [...messages].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return sortedMessages[0]?.mailgunMessageId || null;
  }, [messages]);

  // Draft autosave payload
  const getDraftPayload = () => ({
    ...(draftIdRef.current ? { draftId: draftIdRef.current } : {}),
    fromMailgunId: fromSender[0]?.value || null,
    to: toRecipients.map((r) => r.email || r.value).join(", ") || null,
    cc: ccRecipients.map((r) => r.email || r.value).join(", ") || null,
    bcc: bccRecipients.map((r) => r.email || r.value).join(", ") || null,
    html: formData.email_body,
    text: formData.email_body,
    attachments: formatAttachmentsForPayload(),
    threadId: threadId || thread?._id || thread?.threadId || null,
    careerId: thread?.careerId || null,
    orgId: orgID || user?.orgID || user?.organizationId,
  });

  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);
  const { triggerSave: triggerDraftSave } = useEmailDraft({
    initialDraft: getDraftPayload(),
    onDraftSaved: () => setLastDraftSavedAt(new Date()),
    debounceMs: 1200,
  });

  const collapsedRecipients = useMemo(() => {
    const seen = new Set<string>();
    const combined = [...toRecipients, ...ccRecipients, ...bccRecipients];
    return combined.filter((recipient) => {
      if (!recipient || !recipient.value) return false;
      if (seen.has(recipient.value)) return false;
      seen.add(recipient.value);
      return true;
    });
  }, [toRecipients, ccRecipients, bccRecipients]);

  // Handle click outside to collapse recipient UI
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const container = receiverRef.current;
      if (!container) return;
      if (container.contains(event.target as Node)) {
        setShowRecipientUI(true);
      } else {
        setShowRecipientUI(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, []);

  // Scroll to top of the receiver section when expanded
  useEffect(() => {
    if (showRecipientUI && receiverRef.current) {
      receiverRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [showRecipientUI]);

  // Prefill reply body when this thread has an existing draft reply (reply-draft thread)
  useEffect(() => {
    if (!initialDraft) {
      draftIdRef.current = null;
      hasPrefilledFromDraftRef.current = false;
      hasPrefilledCcBccRef.current = false;
      return;
    }
    const draftId = initialDraft._id ? String(initialDraft._id) : null;
    if (draftIdRef.current !== draftId) {
      hasPrefilledFromDraftRef.current = false;
      hasPrefilledCcBccRef.current = false;
    }
    if (hasPrefilledFromDraftRef.current) return;
    hasPrefilledFromDraftRef.current = true;
    draftIdRef.current = draftId;
    const body =
      initialDraft.html ??
      initialDraft.text ??
      (initialDraft as any).content ??
      "";
    if (body) {
      setFormData((prev) => ({ ...prev, email_body: body }));
    }
  }, [initialDraft?._id, initialDraft?.html, initialDraft?.text]);

  // Prefill cc/bcc from draft when opening a reply draft
  useEffect(() => {
    if (!initialDraft || !recipientOptions.length || hasPrefilledCcBccRef.current) return;
    const draftId = initialDraft._id ? String(initialDraft._id) : null;
    if (draftIdRef.current !== draftId) return;
    hasPrefilledCcBccRef.current = true;
    const ccRaw = (initialDraft as any).ccRaw ?? (Array.isArray((initialDraft as any).cc) ? (initialDraft as any).cc.join(", ") : (initialDraft as any).cc) ?? "";
    const bccRaw = (initialDraft as any).bccRaw ?? (Array.isArray((initialDraft as any).bcc) ? (initialDraft as any).bcc.join(", ") : (initialDraft as any).bcc) ?? "";
    if (!ccRaw && !bccRaw) return;
    const matchEmailsToRecipients = (raw: string): any[] => {
      const emails = raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      return emails.map((email) => {
        const lower = email.toLowerCase();
        const opt = recipientOptions.find(
          (o) =>
            o.value?.toLowerCase() === lower ||
            o.email?.toLowerCase() === lower ||
            (typeof o.value === "string" && o.value.toLowerCase().includes(lower)),
        );
        return opt ?? { value: email, label: email, email };
      });
    };
    if (ccRaw && String(ccRaw).trim()) {
      setShowCc(true);
      setCcRecipients(matchEmailsToRecipients(String(ccRaw).trim()));
    }
    if (bccRaw && String(bccRaw).trim()) {
      setShowBcc(true);
      setBccRecipients(matchEmailsToRecipients(String(bccRaw).trim()));
    }
  }, [
    initialDraft?._id,
    initialDraft?.ccRaw,
    initialDraft?.cc,
    initialDraft?.bccRaw,
    initialDraft?.bcc,
    recipientOptions.length,
  ]);

  // Handle form data change
  const handleChange = ({ id, value }: { id: string; value: string }) => {
    setFormData((prev) => {
      const next = { ...prev, [id]: value };
      const payload = getDraftPayload();
      triggerDraftSave({
        ...payload,
        [id === "email_subject" ? "subject" : "html"]: value,
        text: id === "email_body" ? value : payload.text,
      });
      return next;
    });
  };

  // Save draft on any change to recipients or attachments
  useEffect(() => {
    if (fromSender && fromSender.length > 0 && fromSender[0]?.value) {
      triggerDraftSave(getDraftPayload());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toRecipients, ccRecipients, bccRecipients, attachments]);

  // Handle sending the reply
  const handleSendReply = async () => {
    const success = await sendEmail({
      fromSender,
      toRecipients,
      ccRecipients: showCc ? ccRecipients : [],
      bccRecipients: showBcc ? bccRecipients : [],
      subject: replySubject,
      body: formData.email_body,
      orgId: orgID || user?.orgID || user?.organizationId,
      careerId: thread?.careerId || null,
      attachments: formatAttachmentsForPayload(),
      threadId: threadId || null,
      inReplyTo: inReplyToMessageId,
      requireSubject: false,
      gmailEmails,
      draftId: draftIdRef.current || undefined,
    });

    if (success) {
      successToast("Reply sent successfully!", 1600);
      // Reset form on success
      setFormData({ email_subject: "", email_body: "" });
      clearAttachments();
      setShowCc(false);
      setShowBcc(false);
      if (onReplySuccess) {
        onReplySuccess();
      }
    }
  };

  // Discard handler: delete draft from DB when present, then clear and close
  const handleDiscard = () =>
    handleDiscardEmail({
      setFormData,
      clearAttachments,
      setShowCc,
      setShowBcc,
      onClose,
      onBeforeDiscard: async () => {
        const draftId = draftIdRef.current;
        if (!draftId) return;
        try {
          await apiClient.post("/api/mailgun-module/mg-delete-draft", {
            draftId,
          });
          onDraftDeleted?.();
        } catch (err) {
          console.error("Failed to delete draft:", err);
          errorToast("Failed to delete draft", 3000);
        }
      },
    });

  return (
    <div className={styles.messageCard}>
      <div className={styles.senderContainer} ref={receiverRef}>
        <div className={styles.senderAvatar}>
          <AvatarImage
            src={
              fromSender[0]?.imageSrc
                ? fromSender[0].imageSrc
                : fromSender[0]?.label
                  ? `https://api.dicebear.com/9.x/glass/svg?seed=${fromSender[0].label}`
                  : undefined
            }
            alt={fromSender[0]?.label || "Sender"}
          />
          <Button
            icon="/iconsV2/corner-up-left.svg"
            label="Reply"
            variant="secondary"
            onClick={() => {}}
          />
        </div>
        <div
          className={styles.inputGroup}
          style={{ height: "100%", justifyContent: "center", padding: 0 }}
        >
          <div
            className={`${styles.inputRow} ${showRecipientUI ? styles.column : ""}`}
            style={{
              padding: 0,
            }}
          >
            {/* Sender */}
            <div className={styles.inputRowInner}>
              {showRecipientUI && (
                <>
                  <label className={styles.inputLabel}>From:</label>
                  <AutocompleteField
                    options={filteredSenderOptions}
                    value={fromSender}
                    onChange={setFromSender}
                    selectionMode="single"
                    gmailEmails={gmailEmails}
                    outlookEmails={outlookEmails}
                    renderTag={(sender) => `${sender.label} <${sender.email}>`}
                  />
                </>
              )}
            </div>
            {/* Recipients */}
            <div className={styles.inputRowInner}>
              {showRecipientUI && (
                <label className={styles.inputLabel}>To:</label>
              )}
              <AutocompleteField
                options={recipientOptions}
                value={toRecipients}
                onChange={setToRecipients}
                selectionMode="multiple"
                showRecepientUI={showRecipientUI}
                displayValue={collapsedRecipients}
              />
              {showRecipientUI && (
                <span
                  className={styles.ccBccToggle}
                  onClick={() => setShowCc(true)}
                  style={{
                    cursor: "pointer",
                    color: showCc ? "#A4A7AE" : "#717680",
                  }}
                >
                  Cc
                </span>
              )}
              {showRecipientUI && (
                <span
                  className={styles.ccBccToggle}
                  onClick={() => setShowBcc(true)}
                  style={{
                    cursor: "pointer",
                    color: showBcc ? "#A4A7AE" : "#717680",
                  }}
                >
                  Bcc
                </span>
              )}
            </div>
            {showRecipientUI && showCc && (
              <div className={styles.inputRowInner}>
                {showRecipientUI && (
                  <label className={styles.inputLabel}>Cc:</label>
                )}
                <AutocompleteField
                  options={recipientOptions}
                  value={ccRecipients}
                  onChange={setCcRecipients}
                  selectionMode="multiple"
                  showRecepientUI={showRecipientUI}
                />
              </div>
            )}
            {showRecipientUI && showBcc && (
              <div className={styles.inputRowInner}>
                {showRecipientUI && (
                  <label className={styles.inputLabel}>Bcc:</label>
                )}
                <AutocompleteField
                  options={recipientOptions}
                  value={bccRecipients}
                  onChange={setBccRecipients}
                  selectionMode="multiple"
                  showRecepientUI={showRecipientUI}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.replyEmailCard}>
        {/* Editor */}
        <div
          className={styles.editorContainer}
          style={{ height: "auto", border: "none" }}
        >
          <div className={styles.inputGroup}>
            {/* Message */}
            <div className={styles.inputRow}>
              <TokenEditorField
                ref={bodyEditorRef}
                id="email_body"
                type="textarea"
                value={formData.email_body}
                height={200}
                onChange={handleChange}
                onFocus={(id) => setActiveEditorId(id)}
              />
            </div>
            {/* Attachment/s */}
            <div className={styles.inputRow}>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                multiple
                onChange={handleAttachmentChange}
              />
              <div className={styles.attachmentGroup}>
                {attachments.length > 0 &&
                  attachments.map((att, idx) => {
                    const ext =
                      att.filename.split(".").pop()?.toLowerCase() || "";
                    const iconPath = `/icons/fileTypes/${ext}.svg`;
                    return (
                      <div
                        className={attachmentStyles.tagItem}
                        key={`${att.filename}-${idx}`}
                      >
                        <img
                          src={iconPath}
                          alt={ext}
                          style={{ width: 16, height: 16 }}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src =
                              "/icons/fileTypes/default.svg";
                          }}
                        />
                        <span className={styles.attachmentText}>
                          {att.filename}
                        </span>
                        <img
                          src="/iconsV3/x.svg"
                          alt="close"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAttachment(idx);
                          }}
                          style={{
                            width: 14,
                            height: 14,
                            cursor: "pointer",
                          }}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
          <div className={styles.richTextToolbarWrapper}>
            <RichTextToolbar
              subjectEditorHandle={subjectEditorRef}
              bodyEditorHandle={bodyEditorRef}
              activeEditorId={activeEditorId}
            />
          </div>
        </div>

        {/* Toolbar and Buttons */}
        <EmailToolbar
          onOpenScheduleSend={() => setIsScheduleSendModalOpen(true)}
          getSchedulePayload={() =>
            ({
              to: toRecipients.map((r) => r.email || r.value).join(", "),
              cc: showCc
                ? ccRecipients.map((r) => r.email || r.value).join(", ")
                : null,
              bcc: showBcc
                ? bccRecipients.map((r) => r.email || r.value).join(", ")
                : null,
              subject: replySubject,
              body: formData.email_body,
              sender:
                fromSender[0]?.label && fromSender[0]?.email
                  ? `${fromSender[0].label} <${fromSender[0].email}>`
                  : fromSender[0]?.email || fromSender[0]?.value || "",
              orgID: orgID || "",
              careerId: thread?.careerId ?? null,
              threadId: threadId ?? thread?.id ?? null,
              accountId: fromSender[0]?.value ?? null,
            }) as ScheduleEmailPayload
          }
          showScheduleButton={showScheduleButton}
          setShowScheduleButton={setShowScheduleButton}
          onSend={handleSendReply}
          isSending={isSending}
          onAttachmentClick={handleAttachmentClick}
          onInsertTemplate={(template) => {
            if (template.body && bodyEditorRef.current?.insertTemplate) {
              bodyEditorRef.current.insertTemplate("", template.body);
            }
            setFormData((prev) => ({
              ...prev,
              email_body: template.body || prev.email_body,
            }));
          }}
          onDiscard={handleDiscard}
          onOpenLinkModal={() =>
            saveEditorSelectionForLinkModal(bodyEditorRef, savedRangeRef)
          }
          onInsertLink={(url) =>
            insertLinkInEditor({
              url,
              bodyEditorRef,
              savedRangeRef,
              setFormData,
            })
          }
          lastDraftSavedAt={lastDraftSavedAt}
        />
      </div>

      {isScheduleSendModalOpen && (
        <ScheduleSendModal
          isOpen={isScheduleSendModalOpen}
          onClose={() => setIsScheduleSendModalOpen(false)}
          getEmailPayload={() =>
            ({
              to: toRecipients.map((r) => r.email || r.value).join(", "),
              cc: showCc
                ? ccRecipients.map((r) => r.email || r.value).join(", ")
                : null,
              bcc: showBcc
                ? bccRecipients.map((r) => r.email || r.value).join(", ")
                : null,
              subject: replySubject,
              body: formData.email_body,
              sender:
                fromSender[0]?.label && fromSender[0]?.email
                  ? `${fromSender[0].label} <${fromSender[0].email}>`
                  : fromSender[0]?.email || fromSender[0]?.value || "",
              orgID: orgID || "",
              careerId: thread?.careerId ?? null,
              threadId: threadId ?? thread?.id ?? null,
              accountId: fromSender[0]?.value ?? null,
            }) as ScheduleEmailPayload
          }
          onScheduled={() => {
            onScheduled?.();
            setIsScheduleSendModalOpen(false);
            onClose?.();
          }}
        />
      )}
    </div>
  );
};

export default ReplyEmailCard;
