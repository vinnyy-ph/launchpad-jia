"use client";

import styles from "./modal.module.scss";
import { Template } from "@/lib/components/sections";
import { Button } from "@/lib/components/ui";
import type { TemplateProps } from "@/lib/types/email.type";
import { memo } from "react";

interface PreviewTemplateProps {
  isVisible: boolean;
  template: TemplateProps | null;
  onClose: () => void;
}

function PreviewTemplate({
  isVisible,
  template,
  onClose,
}: PreviewTemplateProps) {
  return (
    <div className={`${styles.modal} ${isVisible ? styles.active : ""}`}>
      <div className={`${styles.modalContent} ${styles.previewTemplate}`}>
        <div className={styles.header}>
          <span>Preview Template</span>
          <img alt="" src="/icons/x.svg" onClick={onClose} />
        </div>

        <div className={styles.textGroup}>
          <span className={styles.label}>Template Name</span>
          <span className={styles.value}>{template?.template_name}</span>
        </div>

        <Template
          subject={template?.subject || ""}
          message={template?.message || ""}
        />

        <div className={styles.buttonGroup}>
          <Button label="Close" variant="secondary" onClick={onClose} />
        </div>
      </div>
    </div>
  );
}

export default memo(PreviewTemplate);
