import React, { useState, useRef, useEffect } from "react";
import { useEmailDraft } from "@/lib/hooks/useEmailDraft";
import { useDraftPrefill } from "@/lib/hooks/useDraftPrefill";
import styles from "@/lib/components/MailgunComponents/email.module.scss";
import attachmentStyles from "@/lib/components/MailgunComponents/editor/editor.module.scss";
import RichTextToolbar from "@/lib/components/MailgunComponents/editor/RichTextToolbar";
import EmailToolbar from "@/lib/components/MailgunComponents/editor/EmailToolbar";
import TokenEditorField, {
  TokenEditorHandle,
} from "@/lib/components/MailgunComponents/editor/TokenEditorField";
import AutocompleteField from "@/lib/components/MailgunComponents/editor/AutocompleteField";
import { useAppContext } from "@/lib/context/AppContext";
import { useEmailData } from "@/lib/hooks/useEmailData";
import { useEmailAttachments } from "@/lib/hooks/useEmailAttachments";
import { useEmailSending } from "@/lib/hooks/useEmailSending";
import { useEmailCareers } from "@/lib/hooks/useEmailCareers";
import { useEmailSignature } from "@/lib/hooks/useEmailSignature";
import { errorToast, successToast } from "@/lib/Utils";
import { apiClient } from "@/lib/utils/apiClient";
import type { AutocompleteOption } from "@/lib/components/MailgunComponents/editor/AutocompleteField";
import {
  insertTemplateToEditors,
  saveEditorSelectionForLinkModal,
  insertLinkInEditor,
  handleDiscardEmail,
  filterSenderOptionsByRole,
} from "@/lib/utils/emailCandidate";
import ScheduleSendModal, {
  type ScheduleEmailPayload,
} from "./ScheduleSendModal";

interface SenderOption {
  value: string;
  imageSrc?: string;
  label: string;
  email?: string;
  userId?: string;
  id?: string;
}

export type ComposeInitialDraft = {
  _id?: string;
  threadId?: string;
  from?: string;
  fromMailgunId?: string;
  toRaw?: string;
  toList?: string[];
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  ccRaw?: string | null;
  bccRaw?: string | null;
  subject?: string;
  html?: string;
  text?: string;
  careerId?: string;
  [key: string]: any;
};

const ComposeEmailModal = ({
  onClose,
  onEmailSent,
  onScheduled,
  onDraftDiscarded,
  defaultRecipient,
  defaultCareerId,
  initialDraft,
}: {
  onClose: () => void;
  onEmailSent?: () => void;
  onScheduled?: () => void;
  onDraftDiscarded?: () => void;
  defaultRecipient?: string;
  defaultCareerId?: string;
  initialDraft?: ComposeInitialDraft | null;
}) => {
  const [maximize, setMaximize] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [showScheduleButton, setShowScheduleButton] = useState(false);
  const [isScheduleSendModalOpen, setIsScheduleSendModalOpen] = useState(false);
  const [fromSender, setFromSender] = useState<SenderOption[]>([]);
  const [toRecipients, setToRecipients] = useState<AutocompleteOption[]>([]);
  const [ccRecipients, setCcRecipients] = useState<AutocompleteOption[]>([]);
  const [bccRecipients, setBccRecipients] = useState<AutocompleteOption[]>([]);
  const [linkedCareer, setLinkedCareer] = useState<AutocompleteOption[]>([]);
  const [formData, setFormData] = useState({
    email_subject: "",
    email_body: "",
  });
  const [activeEditorId, setActiveEditorId] = useState<string | null>(null);
  const { user, orgID } = useAppContext();

  // Use combined email data hook
  const {
    senderOptions,
    gmailEmails,
    outlookEmails,
    defaultSender,
    recipientOptions,
    isRecipientsLoading,
    isSendersLoading,
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

  const draftIdRef = useRef<string | null>(null);
  const draftThreadIdRef = useRef<string | null>(null);

  // Sync refs from initialDraft so getDraftPayload() includes draftId when editing an existing draft (avoids creating a duplicate on save/close)
  useEffect(() => {
    if (!initialDraft) {
      draftIdRef.current = null;
      draftThreadIdRef.current = null;
      return;
    }
    const id = initialDraft._id ?? initialDraft.draftId;
    draftIdRef.current = id != null ? String(id) : null;
    draftThreadIdRef.current =
      initialDraft.threadId != null ? String(initialDraft.threadId) : null;
  }, [initialDraft?._id, initialDraft?.draftId, initialDraft?.threadId]);

  // Use shared attachment hook (prefill from draft when opening existing draft)
  const draftAttachments = initialDraft?.draftAttachments ?? initialDraft?.attachments;
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

  // Sync attachments when opening a different draft (by draft id so we don't reset on every render)
  useEffect(() => {
    const list = initialDraft?.draftAttachments ?? initialDraft?.attachments;
    setAttachmentsFromDraft(list ?? []);
  }, [initialDraft?._id, initialDraft?.draftId, setAttachmentsFromDraft]);

  // Draft autosave payload: include draftId when editing existing draft (from list) or when we already saved once (savedDraftId) so changing sender updates the same draft
  const getDraftPayload = () => ({
    ...(draftIdRef.current || savedDraftId
      ? { draftId: draftIdRef.current || savedDraftId }
      : {}),
    ...(draftThreadIdRef.current ? { threadId: draftThreadIdRef.current } : {}),
    fromMailgunId: (fromSender[0]?.id ?? fromSender[0]?.value) || null,
    to: toRecipients.map((r) => r.email || r.value).join(", ") || null,
    cc: ccRecipients.map((r) => r.email || r.value).join(", ") || null,
    bcc: bccRecipients.map((r) => r.email || r.value).join(", ") || null,
    subject: formData.email_subject,
    html: formData.email_body,
    text: formData.email_body,
    attachments: formatAttachmentsForPayload(),
    careerId: linkedCareer[0]?.value || null,
    orgId: orgID || user?.orgID || user?.organizationId,
  });
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);
  const {
    triggerSave: triggerDraftSave,
    flush: flushDraftSave,
    savedDraftId,
  } = useEmailDraft({
    // Pass draftId when opening an existing draft so subsequent saves update it instead of creating a new one
    initialDraft:
      initialDraft?._id || initialDraft?.draftId
        ? { draftId: String(initialDraft._id ?? initialDraft.draftId) }
        : {},
    onDraftSaved: () => setLastDraftSavedAt(new Date()),
    debounceMs: 1200,
  });

  // Use shared email sending hook
  const { isSending, sendEmail } = useEmailSending();

  const { careers, loading: isCareersLoading } = useEmailCareers(orgID);

  const careerOptions = careers.map((career) => ({
    value: career.id,
    label: career.jobTitle,
  }));

  useEffect(() => {
    if (defaultSender && defaultSender.length > 0 && fromSender.length === 0) {
      setFromSender(
        defaultSender.map((sender: any) => ({
          ...sender,
          // Prefer account id (gmail:*, outlook:*, or Mailgun ObjectId) so draft/send use correct sender
          value:
            sender.id ?? sender._id ?? sender.value ?? sender.email ?? sender.label ?? "",
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

  // Set default recipient if provided
  useEffect(() => {
    if (
      defaultRecipient &&
      toRecipients.length === 0 &&
      !isRecipientsLoading &&
      recipientOptions.length > 0
    ) {
      const lowerDefaultEmail = defaultRecipient.toLowerCase();
      const matchedRecipient = recipientOptions.find((opt) => {
        const optValue = opt.value?.toLowerCase() || "";
        const optEmail = opt.email?.toLowerCase() || "";
        return optValue === lowerDefaultEmail || optEmail === lowerDefaultEmail;
      });
      if (matchedRecipient) {
        setToRecipients([matchedRecipient]);
      } else {
        // If no exact match found, try partial match
        const partialMatch = recipientOptions.find((opt) => {
          const optValue = opt.value?.toLowerCase() || "";
          const optEmail = opt.email?.toLowerCase() || "";
          return (
            optValue.includes(lowerDefaultEmail) ||
            optEmail.includes(lowerDefaultEmail)
          );
        });
        if (partialMatch) {
          setToRecipients([partialMatch]);
        }
      }
    }
  }, [defaultRecipient, recipientOptions, isRecipientsLoading]);

  // Set default career if provided
  useEffect(() => {
    if (
      defaultCareerId &&
      linkedCareer.length === 0 &&
      careerOptions.length > 0
    ) {
      const matchedCareer = careerOptions.find(
        (opt) => opt.value === defaultCareerId,
      );
      if (matchedCareer) {
        setLinkedCareer([matchedCareer]);
      }
    }
  }, [defaultCareerId, careerOptions]);

  const subjectEditorRef = useRef<TokenEditorHandle | null>(null);
  const bodyEditorRef = useRef<TokenEditorHandle | null>(null);
  const savedRangeRef = useRef<Range | null>(null);

  // Use draft prefill hook to manage initialDraft prefilling
  useDraftPrefill({
    initialDraft,
    recipientOptions,
    filteredSenderOptions,
    careerOptions,
    subjectEditorRef,
    bodyEditorRef,
    setFormData,
    setToRecipients,
    setCcRecipients,
    setBccRecipients,
    setShowCc,
    setShowBcc,
    setFromSender,
    setLinkedCareer,
  });

  // Fetch signature and add to body on initial load
  useEmailSignature({
    fromSender,
    orgID,
    user,
    currentBody: formData.email_body,
    setBody: (body) => setFormData((prev) => ({ ...prev, email_body: body })),
    bodyEditorRef,
  });

  const handleChange = ({ id, value }: { id: string; value: string }) => {
    setFormData((prev) => {
      const next = { ...prev, [id]: value };
      // Save draft on subject/body change
      const payload = getDraftPayload();
      triggerDraftSave({
        ...payload,
        [id === "email_subject" ? "subject" : "html"]: value,
        text: id === "email_body" ? value : payload.text,
      });
      return next;
    });
  };

  const handleSendEmail = async () => {
    // Extract careerId from linkedCareer
    const careerId =
      linkedCareer.length > 0
        ? linkedCareer[0]?.value || null
        : (defaultCareerId ?? null);

    const success = await sendEmail({
      fromSender,
      toRecipients,
      ccRecipients: showCc ? ccRecipients : [],
      bccRecipients: showBcc ? bccRecipients : [],
      subject: formData.email_subject,
      body: formData.email_body,
      orgId: orgID || user?.orgID || user?.organizationId,
      careerId,
      attachments: formatAttachmentsForPayload(),
      gmailEmails,
      draftId: draftIdRef.current || savedDraftId || undefined,
    });

    if (success) {
      successToast("Email sent successfully!", 1600);
      // Reset form and close modal on success
      setFormData({ email_subject: "", email_body: "" });
      setFromSender([]);
      setToRecipients([]);
      setCcRecipients([]);
      setBccRecipients([]);
      setLinkedCareer([]);
      clearAttachments();
      setShowCc(false);
      setShowBcc(false);
      if (onEmailSent) {
        onEmailSent();
      }
      onClose();
    }
  };

  // Toolbar handlers using util functions
  const handleInsertTemplate = (template) =>
    insertTemplateToEditors({
      template,
      subjectEditorRef,
      bodyEditorRef,
      setFormData,
    });

  // Only allow opening link modal if blockStyling is not true for the active editor
  const handleOpenLinkModal = () => {
    if (
      activeEditorId === "email_subject" &&
      subjectEditorRef.current &&
      (subjectEditorRef.current as any).props?.blockStyling
    ) {
      // Block for subject if blockStyling is true
      return;
    }
    saveEditorSelectionForLinkModal(bodyEditorRef, savedRangeRef);
  };

  const handleInsertLink = (url) =>
    insertLinkInEditor({
      url,
      bodyEditorRef,
      savedRangeRef,
      setFormData,
    });

  const handleDiscard = () =>
    handleDiscardEmail({
      setFormData,
      setFromSender,
      setToRecipients,
      setCcRecipients,
      setBccRecipients,
      setLinkedCareer,
      clearAttachments,
      setShowCc,
      setShowBcc,
      onClose,
      onBeforeDiscard: async () => {
        const draftId = draftIdRef.current || savedDraftId;
        if (!draftId) return;
        try {
          await apiClient.post("/api/mailgun-module/mg-delete-draft", {
            draftId,
          });
        } catch (err) {
          console.error("Failed to delete draft:", err);
          errorToast("Failed to delete draft", 3000);
        }
      },
      onAfterDiscard: onDraftDiscarded,
    });

  // On close: save current draft once with latest payload (so we update existing draft, not create a new one) then close
  const handleClose = () => {
    if (fromSender?.length > 0 && fromSender[0]?.value) {
      triggerDraftSave(getDraftPayload());
      flushDraftSave().then(() => onClose());
    } else {
      onClose();
    }
  };

  // Save draft on any change to recipients, sender, attachments, or career
  useEffect(() => {
    // Only trigger save if sender is selected
    if (fromSender && fromSender.length > 0 && fromSender[0]?.value) {
      triggerDraftSave(getDraftPayload());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fromSender,
    toRecipients,
    ccRecipients,
    bccRecipients,
    linkedCareer,
    attachments,
  ]);

  return (
    <div
      className={styles.emailModalOverlay}
      style={{
        background: maximize ? "rgba(0, 0, 0, 0.5)" : "transparent",
        alignItems: maximize ? "center" : "flex-end",
        justifyContent: maximize ? "center" : "flex-end",
        paddingRight: maximize ? 0 : 50,
      }}
      onClick={handleClose}
    >
      <div
        className={styles.composeEmailModal}
        style={{ width: maximize ? 800 : 700 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.title}>
            <img src="/iconsV2/mail.svg" alt="mail" />
            <span>Compose Email</span>
          </div>
          <div className={styles.windowControls}>
            <img src="/icons/minus.svg" alt="minus" onClick={handleClose} />
            {maximize ? (
              <img
                src="/icons/minimize.svg"
                alt="minimize"
                onClick={() => setMaximize(false)}
              />
            ) : (
              <img
                src="/icons/maximize.svg"
                alt="maximize"
                onClick={() => setMaximize(true)}
              />
            )}

            <img src="/icons/close.svg" alt="close" onClick={handleClose} />
          </div>
        </div>

        {/* Editor */}
        <div className={styles.editorContainer}>
          <div className={styles.inputGroup}>
            {/* Sender */}
            <div className={styles.inputRow}>
              <label className={styles.inputLabel}>From:</label>
              <AutocompleteField
                options={filteredSenderOptions}
                value={fromSender}
                onChange={setFromSender}
                selectionMode="single"
                gmailEmails={gmailEmails}
                outlookEmails={outlookEmails}
                renderTag={(sender) => `${sender.label} <${sender.email}>`}
                isLoading={isSendersLoading}
              />
            </div>
            {/* Receiver */}
            <div className={`${styles.inputRow} ${styles.column}`}>
              <div className={styles.inputRowInner}>
                <label className={styles.inputLabel}>To:</label>
                <AutocompleteField
                  options={recipientOptions}
                  value={toRecipients}
                  onChange={setToRecipients}
                  selectionMode="multiple"
                  isLoading={isRecipientsLoading}
                />
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
              </div>
              {showCc && (
                <div className={styles.inputRowInner}>
                  <label className={styles.inputLabel}>Cc:</label>
                  <AutocompleteField
                    options={recipientOptions}
                    value={ccRecipients}
                    onChange={setCcRecipients}
                    selectionMode="multiple"
                    isLoading={isRecipientsLoading}
                  />
                </div>
              )}
              {showBcc && (
                <div className={styles.inputRowInner}>
                  <label className={styles.inputLabel}>Bcc:</label>
                  <AutocompleteField
                    options={recipientOptions}
                    value={bccRecipients}
                    onChange={setBccRecipients}
                    selectionMode="multiple"
                    isLoading={isRecipientsLoading}
                  />
                </div>
              )}
            </div>
            {/* Subject */}
            <div className={styles.inputRow}>
              <label className={styles.inputLabel}>Subject:</label>
              <TokenEditorField
                ref={subjectEditorRef}
                id="email_subject"
                type="input"
                value={formData.email_subject}
                height={24}
                onChange={handleChange}
                onFocus={(id) => setActiveEditorId(id)}
                blockStyling={true}
              />
            </div>
            {/* Link to Career */}
            <div className={styles.inputRow}>
              <label className={styles.inputLabel}>Link to Career:</label>
              <AutocompleteField
                options={careerOptions}
                value={linkedCareer}
                onChange={setLinkedCareer}
                selectionMode="single"
                withoutAvatar
                withoutSubtitle
                isLoading={isCareersLoading}
              />
            </div>
            {/* Message */}
            <div className={styles.inputRow}>
              <TokenEditorField
                ref={bodyEditorRef}
                id="email_body"
                type="textarea"
                value={formData.email_body}
                height={maximize ? 240 : 300}
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
              subject: formData.email_subject,
              body: formData.email_body,
              sender:
                fromSender[0]?.label && fromSender[0]?.email
                  ? `${fromSender[0].label} <${fromSender[0].email}>`
                  : fromSender[0]?.email || fromSender[0]?.value || "",
              orgID: orgID || "",
              careerId: linkedCareer[0]?.value ?? null,
              threadId: null,
              accountId: fromSender[0]?.value ?? null,
            }) as ScheduleEmailPayload
          }
          showScheduleButton={showScheduleButton}
          setShowScheduleButton={setShowScheduleButton}
          onSend={handleSendEmail}
          isSending={isSending}
          onClose={onClose}
          onAttachmentClick={handleAttachmentClick}
          onInsertTemplate={handleInsertTemplate}
          onDiscard={handleDiscard}
          onOpenLinkModal={handleOpenLinkModal}
          onInsertLink={handleInsertLink}
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
              subject: formData.email_subject,
              body: formData.email_body,
              sender:
                fromSender[0]?.label && fromSender[0]?.email
                  ? `${fromSender[0].label} <${fromSender[0].email}>`
                  : fromSender[0]?.label && fromSender[0]?.email
                    ? `${fromSender[0].label} <${fromSender[0].email}>`
                    : fromSender[0]?.email || fromSender[0]?.value || "",
              orgID: orgID || "",
              careerId: linkedCareer[0]?.value ?? null,
              threadId: null,
              accountId: fromSender[0]?.value ?? null,
            }) as ScheduleEmailPayload
          }
          onScheduled={() => {
            onScheduled?.();
            setIsScheduleSendModalOpen(false);
            onClose();
          }}
        />
      )}
    </div>
  );
};

export default ComposeEmailModal;
