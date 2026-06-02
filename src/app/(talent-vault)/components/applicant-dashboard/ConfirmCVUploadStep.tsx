"use client";

import styles from "@/app/(talent-vault)/styles/modules/profile-setup.module.scss";

interface ConfirmCVUploadStepProps {
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmCVUploadStep({ fileName, onConfirm, onCancel }: ConfirmCVUploadStepProps) {
  // Split filename into base and extension
  const lastDotIndex = fileName.lastIndexOf('.');
  const baseName = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';

  return (
    <div className={styles.cvDetailsContainer}>
      <div className={styles.gradient}>
        <div className={styles.cvDetailsCard}>
          <span className={styles.sectionTitle}>
            <img alt="" src="/iconsV3/account.svg" />
            Submit CV
          </span>
          <div className={styles.detailsContainer}>
            <p className={styles.confirmationText}>
              You are about to upload the following file:
            </p>
            <span className={styles.fileTitle}>
              <img alt="" src="/iconsV3/checkV4.svg" />
              <span className={styles.fileName}>
                <span className={styles.baseName}>{baseName}</span>
                <span className={styles.extension}>{extension}</span>
              </span>
              <button
                onClick={onCancel}
                className={styles.cancelButton}
                aria-label="Cancel upload"
              >
                ×
              </button>
            </span>
          </div>
        </div>
      </div>
      <button onClick={onConfirm}>Continue</button>
    </div>
  );
}
