import React, { useState, useEffect } from "react";
import { errorToast } from "@/lib/Utils";
import styles from "@/lib/components/MailgunComponents/email.module.scss";
import Button from "@/lib/components/ui/button/Button";
import Field from "@/lib/components/ui/field/Field";

interface InsertLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertLink?: (url: string, text?: string) => void;
}

const InsertLinkModal = ({
  isOpen,
  onClose,
  onInsertLink,
}: InsertLinkModalProps) => {
  const [linkUrl, setLinkUrl] = useState("");

  function isValidLink(url: string): boolean {
    if (!url) return false;
    const pattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/.*)?$/i;
    return pattern.test(url.trim());
  }

  useEffect(() => {
    if (!isOpen) {
      setLinkUrl("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInsert = () => {
    if (!isValidLink(linkUrl)) {
      errorToast(
        "Please enter a valid link (e.g. facebook.com or https://facebook.com)",
        1600,
      );
      return;
    }
    if (onInsertLink && linkUrl) {
      onInsertLink(linkUrl);
    }
    setLinkUrl("");
    onClose();
  };

  return (
    <div className={styles.emailModalOverlay} onClick={onClose}>
      <div
        className={`${styles.emailModalContainer} ${styles.career}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.icon}>
            <img src="/iconsV2/link.svg" />
          </div>
          <div className={styles.modalTitleWrapper}>
            <span className={styles.modalTitle}>Insert Link</span>
            <span className={styles.modalSubtitle}>
              Add hyperlink to highlighted text
            </span>
          </div>
          <img
            src="/iconsV3/x.svg"
            alt="close"
            onClick={onClose}
            style={{ alignSelf: "flex-start", cursor: "pointer" }}
          />
        </div>

        {/* Content */}
        <div className={styles.modalContent}>
          <Field
            label="Link"
            placeholder="https://..."
            formdata={{ link: linkUrl }}
            onChange={({ value }) => {
              setLinkUrl(value);
            }}
          />
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <Button label="Cancel" variant="secondary" onClick={onClose} />
          <Button
            label="Insert"
            onClick={handleInsert}
            disabled={!linkUrl || !isValidLink(linkUrl)}
          />
        </div>
      </div>
    </div>
  );
};

export default InsertLinkModal;
