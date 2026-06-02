"use client";

import styles from "./modal.module.scss";
import { ButtonV2 } from "@/lib/components/ui";
import { memo, useEffect } from "react";

interface DeleteProps {
  description: string;
  isVisible: boolean;
  label: string;
  onClose: () => void;
  onManage: () => void;
}

export default memo(
  ({ description, isVisible, label, onClose, onManage }: DeleteProps) => {
    useEffect(() => {
      if (!isVisible) return;

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          onClose();
        }
      };

      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }, [isVisible, onClose]);

    return (
      <div
        className={`${styles.modal} ${isVisible ? styles.active : ""}`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className={`${styles.modalContent} ${styles.delete}`}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className={styles.icon}>
            <img alt="" src="/icons/trash-2.svg" />
          </div>
          <img
            alt=""
            className={styles.close}
            src="/icons/x.svg"
            onClick={onClose}
          />
          <span className={styles.label}>{label}</span>
          <span className={styles.description}>{description}</span>
          <div className={styles.buttonGroup}>
            <ButtonV2 label="Cancel" variant="secondary" onClick={onClose} />
            <ButtonV2 label="Delete" variant="tertiary" onClick={onManage} />
          </div>
        </div>
      </div>
    );
  },
);
