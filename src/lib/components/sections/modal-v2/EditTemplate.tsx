"use client";

import styles from "./modal.module.scss";
import { Editor } from "@/lib/components/sections";
import { ButtonV2, FieldV2, ToggleV2 } from "@/lib/components/ui";
import { memo } from "react";

interface EditTemplateProps {
  applyChangesToBase: boolean;
  editorResetKey: number;
  formdata: Record<string, string>;
  isSaving?: boolean;
  isVisible: boolean;
  saveDisabled?: boolean;
  templateName: string;
  onBack: () => void;
  onChange: ({ id, value }: { id: string; value: string }) => void;
  onClose: () => void;
  onSave: () => void;
  onToggleApplyChanges: (checked: boolean) => void;
}

const timeUnitOptions = ["Days", "Hours", "Minutes"];

export default memo(function EditTemplate({
  applyChangesToBase,
  editorResetKey,
  formdata,
  isSaving = false,
  isVisible,
  saveDisabled = false,
  templateName,
  onBack,
  onChange,
  onClose,
  onSave,
  onToggleApplyChanges,
}: EditTemplateProps) {
  const scheduleDelayEnabled = formdata.enable_schedule_send === "true";
  const preferredTimeEnabled = formdata.enable_preferred_time === "true";

  return (
    <div
      className={`${styles.modal} ${styles.editTemplateOverlay} ${isVisible ? styles.active : ""}`}
      style={{ zIndex: 1200 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`${styles.modalContent} ${styles.editTemplateModal}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.headerGroup}>
          <div className={styles.templateHeaderContent}>
            <ButtonV2
              icon="/figma-assets/email-automation/reverse-left.svg"
              label="Back"
              variant="secondary"
              onClick={onBack}
            />
            <div className={styles.textGroup}>
              <span className={styles.value}>Edit</span>
              <span className={styles.label}>{templateName || "Template"}</span>
            </div>
          </div>

          <button className={styles.close} type="button" onClick={onClose}>
            <img alt="" src="/icons/x.svg" />
          </button>
        </div>

        <div className={styles.contentGroup}>
          <FieldV2
            formdata={formdata}
            handleOnChange={onChange}
            id="template_name"
            label="Template Name"
            placeholder="Enter template name"
          />

          <Editor
            dropdownPosition="bottom"
            formdata={formdata}
            key={`subject-${editorResetKey}`}
            label="Subject"
            placeholder="Enter subject"
            toolbarItems={["insertToken"]}
            onChange={onChange}
          />

          <Editor
            formdata={formdata}
            height={225}
            key={`message-${editorResetKey}`}
            label="Message"
            placeholder="Enter message"
            onChange={onChange}
          />

          <div className={styles.templateOptionCard}>
            <div className={styles.optionRow}>
              <div className={styles.optionLabelGroup}>
                <span className={styles.optionLabel}>Schedule Sending</span>
                <span className={styles.optionHint}>(optional)</span>
              </div>
              <span className={styles.optionToggleRow}>
                <ToggleV2
                  checked={scheduleDelayEnabled}
                  onChange={(checked) =>
                    onChange({
                      id: "enable_schedule_send",
                      value: checked ? "true" : "false",
                    })
                  }
                />
                Enable schedule send
              </span>
            </div>

            {scheduleDelayEnabled && (
              <div className={styles.scheduleEditorGroup}>
                <div className={styles.delayRow}>
                  <input
                    className={styles.delayInput}
                    min="1"
                    placeholder="E.g. 2"
                    type="number"
                    value={formdata.schedule_delay || ""}
                    onChange={(event) =>
                      onChange({
                        id: "schedule_delay",
                        value: event.target.value,
                      })
                    }
                  />

                  <div className={styles.delayUnitSelect}>
                    <select
                      value={formdata.schedule_delay_unit || "Days"}
                      onChange={(event) =>
                        onChange({
                          id: "schedule_delay_unit",
                          value: event.target.value,
                        })
                      }
                    >
                      {timeUnitOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <img alt="" src="/figma-assets/email-automation/chevron-down.svg" />
                  </div>
                </div>

                <p className={styles.optionDescription}>
                  Emails using this template will be sent after selected delay.
                </p>
              </div>
            )}

            <div className={styles.optionRow}>
              <div className={styles.optionLabelGroup}>
                <span className={styles.optionLabel}>Preferred Time</span>
                <span className={styles.optionHint}>(optional)</span>
              </div>
              <span className={styles.optionToggleRow}>
                <ToggleV2
                  checked={preferredTimeEnabled}
                  onChange={(checked) =>
                    onChange({
                      id: "enable_preferred_time",
                      value: checked ? "true" : "false",
                    })
                  }
                />
                Enable preferred time
              </span>
            </div>

            {preferredTimeEnabled && (
              <input
                className={styles.timeInput}
                type="time"
                value={formdata.preferred_time || ""}
                onChange={(event) =>
                  onChange({ id: "preferred_time", value: event.target.value })
                }
              />
            )}
          </div>
        </div>

        <div className={styles.templateFooter}>
          <span className={styles.applyToggle}>
            <ToggleV2
              checked={applyChangesToBase}
              onChange={onToggleApplyChanges}
            />
            Also apply changes on base template
          </span>

          <div className={styles.buttonGroup}>
            <ButtonV2 label="Cancel" variant="secondary" onClick={onClose} />
            <ButtonV2
              disabled={isSaving || saveDisabled}
              label={isSaving ? "Saving..." : "Save changes"}
              onClick={onSave}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
