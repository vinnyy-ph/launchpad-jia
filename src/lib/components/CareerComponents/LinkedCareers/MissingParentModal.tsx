"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../ui";
import styles from "./linked-careers.module.scss";

interface MissingParentModalProps {
  open: boolean;
  onClose: () => void;
  onOpenEditPage: () => void;
}

export default function MissingParentModal({
  open,
  onClose,
  onOpenEditPage,
}: MissingParentModalProps) {
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
          aria-labelledby="missing-parent-modal-title"
        >
          <div className={styles.modalHeader}>
            <div className={styles.modalHeaderContent}>
              <h3 id="missing-parent-modal-title" className={styles.modalTitle} style={{ fontWeight: 700 }}>
                No Parent Post Assigned
              </h3>
            </div>
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
            <p className={styles.emptyState} style={{ paddingTop: 0, textAlign: "left", fontWeight: 500 }}>
              No parent post is assigned to this child post yet. Open the edit page to set one.
            </p>
          </div>

          <div className={styles.footerDivider} />

          <div className={styles.modalFooter} style={{ justifyContent: "space-between" }}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onClose}
            >
              Cancel
            </button>
            <Button
              onClick={onOpenEditPage}
              variant="primary"
              label="Edit Career Post"
              size="default"
            />
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
