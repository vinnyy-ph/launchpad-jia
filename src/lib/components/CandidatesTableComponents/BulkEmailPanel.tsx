"use client";

import React, { useState, useEffect, useRef } from "react";
import Button from "@/lib/components/ui/button/Button";
import AutocompleteField from "@/lib/components/MailgunComponents/editor/AutocompleteField";
import TokenEditorField, {
  TokenEditorHandle,
} from "@/lib/components/MailgunComponents/editor/TokenEditorField";
import RichTextToolbar from "@/lib/components/MailgunComponents/editor/RichTextToolbar";
import EmailToolbar from "../MailgunComponents/editor/EmailToolbar";
import styles from "@/lib/components/MailgunComponents/email.module.scss";
import attachmentStyles from "@/lib/components/MailgunComponents/editor/editor.module.scss";
import { useAppContext } from "@/lib/context/AppContext";
import { useEmailData } from "@/lib/hooks/useEmailData";
import { useEmailAttachments } from "@/lib/hooks/useEmailAttachments";
import { useEmailSending } from "@/lib/hooks/useEmailSending";
import { useEmailCareers } from "@/lib/hooks/useEmailCareers";
import { useEmailSignature } from "@/lib/hooks/useEmailSignature";
import Swal from "sweetalert2";
import { successToast, errorToast } from "@/lib/Utils";
import type { AutocompleteOption } from "@/lib/components/MailgunComponents/editor/AutocompleteField";
import {
  insertTemplateToEditors,
  saveEditorSelectionForLinkModal,
  insertLinkInEditor,
  handleDiscardEmail,
  filterSenderOptionsByRole,
  cleanEmailSubject,
} from "@/lib/utils/emailCandidate";
import { apiClient } from "@/lib/utils/apiClient";

interface SenderOption {
  value: string;
  imageSrc?: string;
  label: string;
  email?: string;
  userId?: string;
  id?: string;
}

interface BulkEmailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRows: Array<{ id: string; candidate: any }>;
  onRemoveCandidate: (rowId: string) => void;
}

export default function BulkEmailPanel({
  isOpen,
  onClose,
  selectedRows,
  onRemoveCandidate,
}: BulkEmailPanelProps) {
  const [showTable, setShowTable] = useState(true);
  const [maximize, setMaximize] = useState(false);
  const [fromSender, setFromSender] = useState<SenderOption[]>([]);
  const [toRecipients, setToRecipients] = useState<AutocompleteOption[]>([]);
  const [linkedCareer, setLinkedCareer] = useState<AutocompleteOption[]>([]);
  const [formData, setFormData] = useState({
    email_subject: "",
    email_body: "",
  });
  const [activeEditorId, setActiveEditorId] = useState<string | null>(null);
  const [showScheduleButton, setShowScheduleButton] = useState(false);
  const [isBulkSending, setIsBulkSending] = useState(false);

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

  // Filter sender options based on user role
  const filteredSenderOptions = filterSenderOptionsByRole(
    senderOptions,
    user?.email,
    user?._id,
    user?.roles,
    user?.orgRoles,
    orgID,
    currentOrgRole,
  );

  // Use shared attachment hook
  const {
    attachments,
    fileInputRef,
    handleAttachmentClick,
    handleAttachmentChange,
    removeAttachment,
    clearAttachments,
    formatAttachmentsForPayload,
  } = useEmailAttachments();

  // Use shared email sending hook
  const { isSending: isHookSending, sendEmail } = useEmailSending();
  const isSending = isBulkSending || isHookSending;

  const { careers, loading: isCareersLoading } = useEmailCareers(orgID);

  const careerOptions = careers.map((career) => ({
    value: career.id,
    label: career.jobTitle,
  }));

  const subjectEditorRef = useRef<TokenEditorHandle | null>(null);
  const bodyEditorRef = useRef<TokenEditorHandle | null>(null);
  const savedRangeRef = useRef<Range | null>(null);

  // Set default sender when available
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

  // Populate recipients from selectedRows
  useEffect(() => {
    if (
      !showTable &&
      selectedRows.length > 0 &&
      toRecipients.length === 0 &&
      recipientOptions.length > 0
    ) {
      const bulkRecipients: AutocompleteOption[] = selectedRows
        .map(({ candidate }) => {
          const email = candidate?.email?.toLowerCase();
          if (!email) return null;

          // Find matching recipient option
          const matchedRecipient = recipientOptions.find((opt) => {
            const optValue = opt.value?.toLowerCase() || "";
            const optEmail = opt.email?.toLowerCase() || "";
            return optValue === email || optEmail === email;
          });

          return (
            matchedRecipient || {
              value: email,
              label: candidate?.name || email,
              email: email,
              imageSrc: candidate?.image,
            }
          );
        })
        .filter(
          (
            r,
          ): r is {
            value: string;
            label: string;
            email: string;
            imageSrc: string | undefined;
          } => r !== null,
        );

      setToRecipients(bulkRecipients);
    }
  }, [showTable, selectedRows, recipientOptions, toRecipients.length]);

  // Fetch signature and add to body on initial load
  useEmailSignature({
    fromSender,
    orgID,
    user,
    currentBody: formData.email_body,
    setBody: (body) => setFormData((prev) => ({ ...prev, email_body: body })),
    bodyEditorRef,
  });

  // Reset to table view when panel is closed
  useEffect(() => {
    if (!isOpen) {
      setShowTable(true);
      // Reset form state
      setFormData({ email_subject: "", email_body: "" });
      setFromSender([]);
      setToRecipients([]);
      setLinkedCareer([]);
      clearAttachments();
      setIsBulkSending(false);
    }
  }, [isOpen]);

  const handleChange = ({ id, value }: { id: string; value: string }) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  // Helper to generate a MongoDB-compatible ObjectId string
  const generateObjectId = () => {
    const timestamp = ((new Date().getTime() / 1000) | 0).toString(16);
    return (
      timestamp +
      "xxxxxxxxxxxxxxxx"
        .replace(/[x]/g, () => ((Math.random() * 16) | 0).toString(16))
        .toLowerCase()
    );
  };

  const handleSendEmail = async () => {
    if (toRecipients.length === 0) {
      errorToast("Please select at least one recipient.", 1600);
      return;
    }

    const count = toRecipients.length;
    const result = await Swal.fire({
      title: "Send email to all?",
      text: `Are you sure you want to send this email to ${count} applicant${count === 1 ? "" : "s"}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, send",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    const careerId =
      linkedCareer.length > 0 ? linkedCareer[0]?.value || null : null;
    const campaignId = generateObjectId();
    const primarySender = fromSender[0];
    const senderEmail = primarySender?.email || primarySender?.value || "";
    const cleanedSubject = cleanEmailSubject(formData.email_subject);
    const orgId = orgID || user?.orgID || user?.organizationId;
    const attachmentsPayload = formatAttachmentsForPayload();

    // Capture values for background send (panel may unmount after onClose)
    const recipientsSnapshot = [...toRecipients];
    const bodySnapshot = formData.email_body;
    const fromSenderSnapshot = [...fromSender];

    // Show success immediately and close so user doesn't wait
    successToast(
      `${count} email${count === 1 ? "" : "s"} queued for sending`,
      1600,
    );
    onClose();

    // Send in background (fire-and-forget)
    (async () => {
      let successCount = 0;
      let failCount = 0;
      const threadIds: string[] = [];

      for (const recipient of recipientsSnapshot) {
        const response = await sendEmail({
          fromSender: fromSenderSnapshot,
          toRecipients: [recipient],
          ccRecipients: [],
          bccRecipients: [],
          subject: cleanedSubject,
          body: bodySnapshot,
          orgId,
          careerId,
          attachments: attachmentsPayload,
          gmailEmails,
          campaignId,
        });

        if (response.success) {
          successCount++;
          if (response.threadId) {
            threadIds.push(response.threadId);
          }
        } else {
          failCount++;
        }
      }

      if (successCount > 0) {
        try {
          await apiClient.post("/api/add-email-campaign", {
            campaignId,
            threadIds,
            senderEmail,
            orgId,
            subject: cleanedSubject,
            careerId,
          });
        } catch (error) {
          console.error("Failed to save campaign details:", error);
        }
      }
    })();
  };

  // Toolbar handlers
  const handleInsertTemplate = (template) =>
    insertTemplateToEditors({
      template,
      subjectEditorRef,
      bodyEditorRef,
      setFormData,
    });

  const handleOpenLinkModal = () => {
    if (
      activeEditorId === "email_subject" &&
      subjectEditorRef.current &&
      (subjectEditorRef.current as any).props?.blockStyling
    ) {
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
      setCcRecipients: () => {},
      setBccRecipients: () => {},
      setLinkedCareer,
      clearAttachments,
      setShowCc: () => {},
      setShowBcc: () => {},
      onClose,
    });

  const handleContinue = () => {
    setShowTable(false);
  };

  const handleOpenScheduleSend = () => {
    // Add schedule send logic here
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`bulk-email-overlay ${isOpen ? "show" : ""}`}
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 9998,
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? "visible" : "hidden",
          transition: "opacity 0.3s ease, visibility 0.3s ease",
        }}
      />

      {/* Panel */}
      <div
        className={`bulk-email-panel ${isOpen ? "open" : ""}`}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "600px",
          height: "100%",
          backgroundColor: "#FFFFFF",
          zIndex: 9999,
          boxShadow: "-2px 0 8px rgba(0, 0, 0, 0.15)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s ease",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: "var(--Surface-white, #FFFFFF)",
            borderBottom:
              "1px solid var(--Colors-Secondary_Colors-Blue-gray-100, #EAECF5)",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <h2
              style={{
                fontWeight: 700,
                fontStyle: "Bold",
                fontSize: "18px",
                lineHeight: "28px",
                letterSpacing: "0%",
                color: "var(--Text-text-primary, #181D27)",
                margin: 0,
              }}
            >
              Send Email to All
            </h2>
            <img
              src="/icons/close.svg"
              alt="Close"
              style={{ cursor: "pointer" }}
              onClick={onClose}
            />
          </div>
        </div>

        {/* Content Area */}
        <div
          style={{
            flex: 1,
            width: "100%",
            minWidth: 0,
            height: "100%",
            gap: "12px",
            paddingTop: "16px",
            paddingRight: "24px",
            paddingBottom: "16px",
            paddingLeft: "24px",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          {showTable ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                minWidth: 0,
              }}
            >
              {/* Table */}
              <div
                style={{
                  borderRadius: "16px",
                  border: "1px solid var(--Border-primary, #E9EAEB)",
                  boxShadow: "0px 1px 2px 0px #0A0D120D",
                  overflow: "hidden",
                  background: "#FFFFFF",
                  minWidth: 0,
                  width: "100%",
                }}
              >
                <table
                  className="table align-items-center jia-candidates-table"
                  style={{
                    margin: 0,
                    borderCollapse: "separate",
                    borderSpacing: 0,
                    tableLayout: "fixed",
                    width: "100%",
                  }}
                >
                  <thead
                    style={{
                      height: "42px",
                      background: "var(--Surface-dashboard-bg_light, #F8F9FC)",
                      borderBottom: "1px solid var(--Border-primary, #E9EAEB)",
                      padding: 0,
                    }}
                  >
                    <tr>
                      <th>
                        <span className="candidates-table-header">Name</span>
                      </th>
                      <th>
                        <span className="candidates-table-header">Email</span>
                      </th>
                      <th style={{ width: 60 }} />
                    </tr>
                  </thead>
                  <tbody className="list">
                    {selectedRows.length === 0 ? (
                      <tr style={{ cursor: "default", pointerEvents: "none" }}>
                        <td colSpan={3} style={{ padding: "16px" }}>
                          <span className="candidates-table-cell-text">
                            No candidates selected.
                          </span>
                        </td>
                      </tr>
                    ) : (
                      selectedRows.map(({ id, candidate }) => (
                        <tr
                          key={id}
                          style={{
                            border: "1px solid #E9EAEB",
                            height: "64px",
                          }}
                        >
                          <td style={{ width: "40%", overflow: "hidden" }}>
                            <div
                              className="d-flex align-items-center"
                              style={{
                                gap: "10px",
                                minWidth: 0,
                                width: "100%",
                                maxWidth: "100%",
                                overflow: "hidden",
                              }}
                            >
                              {candidate?.image ? (
                                <img
                                  src={candidate.image}
                                  alt="Candidate"
                                  style={{
                                    width: "32px",
                                    height: "32px",
                                    borderRadius: "50%",
                                    border: "none",
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: "32px",
                                    height: "32px",
                                    borderRadius: "50%",
                                    backgroundColor: "#F8F9FC",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  <span className="candidates-table-avatar-initials">
                                    {(candidate?.name || "")
                                      .split(" ")
                                      .map((name: string) => name[0])
                                      .join("")}
                                  </span>
                                </div>
                              )}
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 0,
                                  minWidth: 0,
                                  overflow: "hidden",
                                }}
                              >
                                <span
                                  className="candidates-table-candidate-name"
                                  style={{
                                    display: "block",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {candidate?.name || ""}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td style={{ width: "55%", overflow: "hidden" }}>
                            <span
                              className="candidates-table-cell-text candidates-table-cell-text-ellipsis"
                              style={{
                                display: "block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {candidate?.email || ""}
                            </span>
                          </td>
                          <td style={{ width: "5%", textAlign: "center" }}>
                            <img
                              src="/icons/trash.svg"
                              alt="Remove"
                              width={16}
                              height={16}
                              onClick={() => onRemoveCandidate(id)}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <>
              {/* Email Editor */}
              <div
                className={styles.editorContainer}
                style={{ height: "fit-content" }}
              >
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
                      renderTag={(sender) =>
                        `${sender.label} <${sender.email}>`
                      }
                      isLoading={isSendersLoading}
                    />
                  </div>
                  {/* Recipients */}
                  <div className={styles.inputRow}>
                    <label className={styles.inputLabel}>Recipients:</label>
                    <AutocompleteField
                      options={recipientOptions}
                      value={toRecipients}
                      onChange={setToRecipients}
                      selectionMode="multiple"
                      isLoading={isRecipientsLoading}
                      readOnly
                      showRecepientUI={false}
                    />
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
                      height={320}
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
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            width: "100%",
            gap: "12px",
            borderTop:
              "1px solid var(--Colors-Secondary_Colors-Blue-gray-100, #EAECF5)",
            padding: "24px",
            display: "flex",
            flexDirection: "row",
            justifyContent: showTable ? "flex-end" : "space-between",
            alignItems: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {showTable ? (
            <>
              <Button variant="secondary" label="Cancel" onClick={onClose} />
              <Button
                variant="primary"
                label="Continue"
                onClick={handleContinue}
                disabled={selectedRows.length === 0}
              />
            </>
          ) : (
            <EmailToolbar
              onSend={handleSendEmail}
              isSending={isSending}
              onClose={onClose}
              onAttachmentClick={handleAttachmentClick}
              onInsertTemplate={handleInsertTemplate}
              onDiscard={handleDiscard}
              onOpenLinkModal={handleOpenLinkModal}
              onInsertLink={handleInsertLink}
              onOpenScheduleSend={handleOpenScheduleSend}
              showScheduleButton={showScheduleButton}
              setShowScheduleButton={setShowScheduleButton}
              hideScheduleSend
            />
          )}
        </div>
      </div>
    </>
  );
}
