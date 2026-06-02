"use client";

import styles from "./modal.module.scss";
import { Button } from "@/lib/components/ui";
import { memo } from "react";

interface DeleteProps {
  description: string;
  isVisible: boolean;
  label: string;
  onClick: () => void;
  onClose: () => void;
}

function Delete({
  description,
  isVisible,
  label,
  onClick,
  onClose,
}: DeleteProps) {
  return (
    <div className={`${styles.modal} ${isVisible ? styles.active : ""}`}>
      <div className={`${styles.modalContent} ${styles.delete}`}>
        <div className={styles.icon}>
          <img alt="" src="/icons/trash-2.svg" />
        </div>

        <span className={styles.label}>{label}</span>
        <span className={styles.description}>{description}</span>

        <div className={styles.buttonGroup}>
          <Button
            label="Cancel"
            size="large"
            variant="secondary"
            onClick={onClose}
          />
          <Button
            label="Delete"
            size="large"
            variant="tertiary"
            onClick={onClick}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(Delete);
