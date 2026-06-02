"use client";

import styles from "@/app/(talent-vault)/styles/modules/applicant-dashboard.module.scss";

type VisibilityConfirmModalProps = {
  open: boolean;
  onCancel(): void;
  onConfirm(): void;
  isSubmitting?: boolean;
};

export function VisibilityConfirmModal({
  open,
  onCancel,
  onConfirm,
  isSubmitting = false,
}: VisibilityConfirmModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={styles.visibilityConfirmOverlay} role="dialog" aria-modal="true">
      <div className={styles.visibilityConfirmCard}>
        <h3>Set profile to inactive?</h3>
        <p>
          Your Talent Vault profile will no longer be visible to employers until
          you activate it again.
        </p>
        <div className={styles.visibilityConfirmActions}>
          <button
            type="button"
            className={styles.visibilityConfirmCancel}
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.visibilityConfirmPrimary}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Set Inactive"}
          </button>
        </div>
      </div>
    </div>
  );
}
