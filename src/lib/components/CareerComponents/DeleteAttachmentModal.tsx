"use client";

import { useEffect } from "react";
import styles from "@/lib/styles/components/stage-attachments.module.scss";

interface DeleteAttachmentModalProps {
  filename: string;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export default function DeleteAttachmentModal({
  filename,
  onCancel,
  onConfirm,
  isDeleting = false,
}: DeleteAttachmentModalProps) {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modalWrapper}>
        <div
          className={styles.deleteModalShell}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Trash icon with background */}
          <div className={styles.deleteIconContainer}>
            <div className={styles.deleteIconOuter}>
              <div className={styles.deleteIconInner}>
                <i className="la la-trash-alt" />
              </div>
            </div>
          </div>

          {/* Title */}
          <h3 className={styles.deleteModalTitle}>Delete attachment</h3>

          {/* Description */}
          <p className={styles.deleteModalDescription}>
            Are you sure you want to delete
            <br />
            '{filename}'?
          </p>

          {/* Buttons */}
          <div className={styles.deleteModalButtons}>
            <button
              className={styles.deleteModalCancelButton}
              onClick={onCancel}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              className={styles.deleteModalConfirmButton}
              onClick={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

