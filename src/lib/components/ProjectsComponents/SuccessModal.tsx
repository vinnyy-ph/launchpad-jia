"use client";

import styles from "@/lib/styles/screens/manage-project.module.scss";

interface SuccessModalProps {
  title: string;
  description: string;
  onClose: () => void;
}

export default function SuccessModal({ title, description, onClose }: SuccessModalProps) {
  return (
    <div
      className={styles.modalBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.successModal}>
        <div className={styles.successModalContent}>
          <div className={styles.successIconContainer}>
            <div className={styles.successIconOuter}>
              <div className={styles.successIconInner}>
                <i className="la la-check"></i>
              </div>
            </div>
          </div>
          <h3 className={styles.successModalTitle}>{title}</h3>
          <p className={styles.successModalDescription}>{description}</p>
        </div>
        <div className={styles.successModalFooter}>
          <button className={styles.successCloseButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
