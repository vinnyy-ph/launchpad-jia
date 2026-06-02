"use client";

import styles from "./modal.module.scss";
import { TemplateV2 } from "@/lib/components/sections";
import { ButtonV2, ToggleV2 } from "@/lib/components/ui";
import type {
  EmailAutomationCardProps,
  TemplateProps,
} from "@/lib/types/email.type";
import { memo, useEffect, useMemo, useState } from "react";

interface PreviewAutomationProps {
  automation:
    | (EmailAutomationCardProps & { template?: TemplateProps | null })
    | null;
  isVisible: boolean;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onToggle: (checked: boolean) => void;
}

function formatTemplateType(
  automation:
    | (EmailAutomationCardProps & { template?: TemplateProps | null })
    | null,
) {
  if (!automation?.template?.type) {
    return automation?.sender === "System" ? "System" : "User";
  }

  const value = String(automation.template.type);
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function getActionIcon(trigger?: string) {
  if (trigger === "Reminder") {
    return "/icons/bell.svg";
  }

  if (trigger === "Drop") {
    return "/figma-assets/email-automation/arrow-down.svg";
  }

  return "/figma-assets/email-automation/arrow-up.svg";
}

export default memo(
  ({
    automation,
    isVisible,
    onClose,
    onDelete,
    onEdit,
    onToggle,
  }: PreviewAutomationProps) => {
    const [previewWithSample, setPreviewWithSample] = useState(false);
    const isDefaultAutomation = Boolean(automation?.default_automation_id);
    const isSystemAutomation =
      automation?.sender === "System" || isDefaultAutomation;
    const templateType = useMemo(() => formatTemplateType(automation), [automation]);

    useEffect(() => {
      if (!isVisible) {
        setPreviewWithSample(false);
      }
    }, [isVisible]);

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
          className={`${styles.modalContent} ${styles.previewAutomation}`}
          data-dropdown-root="true"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className={styles.headerGroup}>
            <div className={styles.icon}>
              <img alt="" src="/figma-assets/email-automation/eye.svg" />
            </div>
            <div className={styles.textGroup}>
              <span className={styles.value}>
                {automation?.automation_name || "Automation"}
              </span>
              <span className={styles.label}>Preview automation</span>
            </div>
            <button className={styles.close} type="button" onClick={onClose}>
              <img alt="" src="/icons/x.svg" />
            </button>
          </div>

          <div className={styles.contentGroup}>
            <div className={styles.statusGroup}>
              <span className={styles.name}>
                {automation?.automation_name || "Untitled automation"}
              </span>
              <span
                className={`${styles.status} ${
                  automation?.active ? styles.active : styles.inactive
                }`}
              >
                {automation?.active && (
                  <img alt="" src="/figma-assets/email-automation/zap.svg" />
                )}
                {automation?.active ? "Active" : "Inactive"}
              </span>
              <ToggleV2 checked={Boolean(automation?.active)} onChange={onToggle} />
            </div>

            <div className={styles.templateGroup}>
              <span className={styles.name}>
                Template: {automation?.template?.template_name || "Unknown template"}
              </span>
              <span className={styles.type}>{templateType}</span>
              <div
                className={`${styles.editIconButton} ${
                  isSystemAutomation ? styles.disabled : ""
                }`}
                onClick={() => {
                  if (isSystemAutomation) return;
                  onEdit();
                }}
              >
                <img alt="" src="/figma-assets/email-automation/edit-01.svg" />
              </div>
            </div>

            <div className={styles.templateWrapper}>
              <TemplateV2
                message={automation?.template?.message || ""}
                previewWithSample={previewWithSample}
                subject={automation?.template?.subject || ""}
              />
            </div>

            <span className={styles.preview}>
              <ToggleV2
                checked={previewWithSample}
                onChange={setPreviewWithSample}
              />
              Preview with sample values
            </span>

            <hr />

            <div className={styles.detailsGroup}>
              <div className={styles.textGroup}>
                <span className={styles.label}>From</span>
                <div className={styles.valueGroup}>
                  <span className={styles.value}>
                    {automation?.from_stage || "Any stage"}
                  </span>
                </div>
              </div>

              <div className={styles.textGroup}>
                <span className={styles.label}>To</span>
                <div className={styles.valueGroup}>
                  <span className={styles.value}>
                    {automation?.to_stage || "N/A"}
                  </span>
                </div>
              </div>

              <div className={styles.textGroup}>
                <span className={styles.label}>Action</span>
                <div className={styles.valueGroup}>
                  <span className={`${styles.value} ${styles.type}`}>
                    <img alt="" src={getActionIcon(automation?.trigger_on_event)} />
                    {automation?.trigger_on_event === "Reminder" &&
                    automation?.reminder_delay &&
                    automation?.reminder_delay_unit
                      ? `Reminder after ${automation.reminder_delay} ${
                          automation.reminder_delay === "1"
                            ? automation.reminder_delay_unit.toLowerCase().replace(/s$/, "")
                            : automation.reminder_delay_unit.toLowerCase()
                        }`
                      : automation?.trigger_on_event || "N/A"}
                  </span>
                </div>
              </div>

              <div className={styles.textGroup}>
                <span className={styles.label}>Created by</span>
                <div className={styles.valueGroup}>
                  <span className={styles.value}>{automation?.sender || "N/A"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.buttonGroup}>
            {!isDefaultAutomation && (
              <span className={styles.deleteButton} onClick={onDelete}>
                <img alt="" src="/figma-assets/email-automation/trash-01.svg" />
                Delete
              </span>
            )}
            <div className={styles.actionButtons}>
              <ButtonV2 label="Close" variant="secondary" onClick={onClose} />
              <ButtonV2
                disabled={isSystemAutomation}
                icon="/figma-assets/email-automation/edit-01.svg"
                label="Edit Automation"
                onClick={onEdit}
              />
            </div>
          </div>
        </div>
      </div>
    );
  },
);
