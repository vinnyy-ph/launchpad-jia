import React, { useState } from "react";
import Button from "@/lib/components/ui/button/Button";
import styles from "@/lib/components/MailgunComponents/editor/editor.module.scss";
import InsertTemplateModal from "@/lib/components/MailgunComponents/components/InsertTemplateModal";
import InsertLinkModal from "@/lib/components/MailgunComponents/editor/InsertLinkModal";
import { timeAgo } from "@/lib/utils/emailCandidate";
import type { ScheduleEmailPayload } from "@/lib/components/MailgunComponents/components/ScheduleSendModal";

type EmailToolbarProps = {
  onOpenScheduleSend?: (getPayload?: () => ScheduleEmailPayload | null) => void;
  getSchedulePayload?: () => ScheduleEmailPayload | null;
  showScheduleButton?: boolean;
  setShowScheduleButton?: React.Dispatch<React.SetStateAction<boolean>>;
  hideScheduleSend?: boolean;
  onSend?: () => void;
  isSending?: boolean;
  onClose?: () => void;
  onAttachmentClick?: () => void;
  onInsertTemplate?: (payload: {
    subject: string;
    body: string;
    template?: any;
  }) => void;
  onDiscard?: () => void;
  onInsertLink?: (url: string, text?: string) => void;
  onOpenLinkModal?: () => void;
  lastDraftSavedAt?: Date | null;
};

const EmailToolbar = ({
  onOpenScheduleSend,
  getSchedulePayload,
  showScheduleButton = false,
  setShowScheduleButton,
  hideScheduleSend = false,
  onSend,
  isSending = false,
  onClose,
  onAttachmentClick,
  onInsertTemplate,
  onDiscard,
  onInsertLink,
  onOpenLinkModal,
  lastDraftSavedAt,
}: EmailToolbarProps) => {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const handleOpenTemplateModal = () => {
    setIsTemplateModalOpen(true);
  };

  const handleCloseTemplateModal = () => {
    setIsTemplateModalOpen(false);
  };

  // Handler for selecting a template from the new InsertTemplateModal
  const handleSelectTemplate = (template: any) => {
    if (onInsertTemplate) {
      onInsertTemplate({
        subject: template?.subject || "",
        body: template?.content || "",
        template,
      });
    }
    setIsTemplateModalOpen(false);
  };

  return (
    <div className={styles.footer}>
      <div className={styles.emailToolbar}>
        <div className={styles.toolbarGroup}>
          {/* Discard */}
          <div className={styles.toolbarButton} onClick={onDiscard}>
            <img src="/icons/toolbars/email/trash.svg" alt="delete" />
          </div>
        </div>
        <div className={styles.toolbarDivider} />
        <div className={styles.toolbarGroup}>
          {/* Attachment */}
          <div className={styles.toolbarButton} onClick={onAttachmentClick}>
            <img src="/icons/toolbars/email/attachment.svg" alt="attach" />
          </div>
          {/* Link */}
          <div
            className={styles.toolbarButton}
            onClick={() => {
              if (onOpenLinkModal) onOpenLinkModal();
              setIsLinkModalOpen(true);
            }}
          >
            <img src="/icons/toolbars/email/link.svg" alt="link" />
          </div>
          {/* TODO: Image */}
          {/* <div className={styles.toolbarButton}>
            <img src="/icons/toolbars/email/image.svg" alt="delete" />
          </div> */}
        </div>

        <div className={styles.toolbarDivider} />
        {/* TODO: Emoji */}
        {/* <div className={styles.toolbarGroup}>
          <div className={styles.toolbarButton}>
            <img src="/icons/toolbars/email/face-happy.svg" alt="delete" />
          </div>
        </div>
        <div className={styles.toolbarDivider} /> */}
        {/* Insert Template */}
        <button className={styles.insertBtn} onClick={handleOpenTemplateModal}>
          Insert Template <img src="/icons/toolbars/arrow.svg" alt="template" />
        </button>
      </div>

      <div className={styles.actionsGroup}>
        <div className={styles.draftSaved}>
          {lastDraftSavedAt ? (
            <>
              <img src="/icons/check-circle-broken.svg" alt="saved" />
              <span>Draft saved ({timeAgo(lastDraftSavedAt)})</span>
            </>
          ) : (
            ""
          )}
        </div>

        <div className={styles.sendBtn} style={{ position: "relative" }}>
          {!hideScheduleSend && showScheduleButton && (
            <Button
              label="Schedule send"
              icon="/icons/scheduled.svg"
              variant="secondary"
              onClick={() => {
                onOpenScheduleSend?.(getSchedulePayload ?? undefined);
                setShowScheduleButton?.(false);
              }}
              style={{
                position: "absolute",
                bottom: 48,
                right: 0,
                zIndex: 5,
                width: "max-content",
                boxShadow:
                  "0px 12px 16px -4px rgba(10, 13, 18, 8%), 0px 4px 6px -2px rgba(10, 13, 18, 3%), 0px 2px 2px -1px rgba(10, 13, 18, 4%)",
              }}
            />
          )}
          <Button
            label={isSending ? "Sending..." : "Send"}
            onClick={onSend ?? onClose ?? (() => {})}
            disabled={isSending}
            style={
              hideScheduleSend
                ? undefined
                : { borderTopRightRadius: 0, borderBottomRightRadius: 0 }
            }
          />
          {!hideScheduleSend && (
            <Button
              label=""
              icon="/iconsV2/chevron-down.svg"
              onClick={() => setShowScheduleButton?.((prev) => !prev)}
              disabled={isSending}
              style={{
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
                width: 41,
                height: 41,
              }}
            />
          )}
        </div>
      </div>
      {isTemplateModalOpen && (
        <InsertTemplateModal
          isOpen={isTemplateModalOpen}
          onClose={handleCloseTemplateModal}
          onSelectTemplate={handleSelectTemplate}
        />
      )}
      {isLinkModalOpen && (
        <InsertLinkModal
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          onInsertLink={onInsertLink}
        />
      )}
    </div>
  );
};

export default EmailToolbar;
