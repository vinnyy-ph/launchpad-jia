"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./postingtypes-help-modal.module.scss";
import EndToEndCareerHelp from "./EndToEndCareerHelp";
import LinkedCareerHelp from "./LinkedCareerHelp";

const POSTING_TYPE_TABS = [
  { value: "end-to-end" as const, label: "End-to-end Career" },
  { value: "linked" as const, label: "Linked Career" },
] as const;
type PostingTypeTabValue = (typeof POSTING_TYPE_TABS)[number]["value"];

interface PostingTypeHelpModalProps {
  open: boolean;
  onClose: () => void;
}

export default function PostingTypeHelpModal({
  open,
  onClose,
}: PostingTypeHelpModalProps) {
  const [activeTab, setActiveTab] = useState<PostingTypeTabValue>("end-to-end");

  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const modalContent = (
    <div className={styles.modalBackground} onClick={onClose}>
      <div className={styles.modalContainer}>
        <div
          className={styles.modalContent}
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="posting-type-help-modal-title"
        >
          <div className={styles.modalHeader}>
            <h3 id="posting-type-help-modal-title" className={styles.modalTitle}>
              Career Posting Types
            </h3>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>

          <div className={styles.modalBody}>
            <div className={`${styles.helpModalTabs} career-tab-container`}>
              <div className="career-tab-content">
                {POSTING_TYPE_TABS.map((tab) => (
                  <div
                    key={tab.value}
                    className={`career-tab-item ${activeTab === tab.value ? "active" : ""}`}
                    onClick={() => setActiveTab(tab.value)}
                  >
                    {tab.label}
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.tabPanel}>
              {activeTab === "end-to-end" && <EndToEndCareerHelp />}
              {activeTab === "linked" && <LinkedCareerHelp />}
            </div>
          </div>

          <div className={styles.footerDivider} />

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={onClose}
            >
              Got It
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(modalContent, document.body);
}
