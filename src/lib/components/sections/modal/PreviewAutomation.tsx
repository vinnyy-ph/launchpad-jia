import styles from "./modal.module.scss";
import type {
  EmailAutomationCardProps,
  TemplateProps,
} from "@/lib/types/email.type";
import { Template } from "@/lib/components/sections";
import { Tooltip } from "@/lib/components/ui";
import { memo } from "react";

interface PreviewAutomationProps {
  automation:
    | (EmailAutomationCardProps & { template?: TemplateProps | null })
    | null;
  isVisible: boolean;
  onClose: () => void;
}

function PreviewAutomation({
  automation,
  isVisible,
  onClose,
}: PreviewAutomationProps) {
  return (
    <div className={`${styles.modal} ${isVisible ? styles.active : ""}`}>
      <div className={`${styles.modalContent} ${styles.previewAutomation}`}>
        <div className={styles.header}>
          <span>View Automation</span>
          <img alt="" src="/icons/x.svg" onClick={onClose} />
        </div>

        <div className={styles.detailsGroup}>
          <div className={styles.textGroup}>
            <span className={styles.label}>Automation Name</span>
            <span className={styles.value}>
              {automation?.automation_name || "N/A"}
            </span>
          </div>

          <div className={styles.textGroup}>
            <span className={styles.label}>From Stage</span>
            <span className={styles.value}>
              {automation?.from_stage || "N/A"}
            </span>
          </div>

          <div className={styles.textGroup}>
            <span className={styles.label}>To Stage</span>
            <span className={styles.value}>
              {automation?.to_stage || "N/A"}
            </span>
          </div>

          <div className={styles.textGroup}>
            <span className={styles.label}>Trigger on Event</span>
            <span className={styles.value}>
              {automation?.trigger_on_event || "N/A"}
            </span>
          </div>

          <div className={styles.textGroup}>
            <span className={styles.label}>Created by</span>
            <span className={`${styles.value} ${styles.creator}`}>
              {automation?.sender || "N/A"}
              {automation?.sender == "System" && (
                <Tooltip
                  message="System-created automations cannot be edited and deleted, but can be toggled off or overridden."
                  width={315}
                />
              )}
            </span>
          </div>
        </div>

        <Template
          subject={automation?.template?.subject || ""}
          message={automation?.template?.message || ""}
        />
      </div>
    </div>
  );
}

export default memo(PreviewAutomation);
