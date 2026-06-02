"use client";

import styles from "./modal.module.scss";
import { Editor } from "@/lib/components/sections";
import { Button, Field, Toggle, Dropdown } from "@/lib/components/ui";
import { memo, useEffect, useRef, useState } from "react";

interface OnChangeProps {
  id: string;
  value: string;
}

interface ManageTemplateProps {
  formdata: Record<string, string>;
  isVisible: boolean;
  variant: "add" | "edit" | null;
  onChange: ({ id, value }: OnChangeProps) => void;
  onClick: () => void;
  onClose: () => void;
}

function ManageTemplate({
  formdata,
  isVisible,
  variant,
  onChange,
  onClick,
  onClose,
}: ManageTemplateProps) {
  const initialFormdataRef = useRef<Record<string, string>>({});
  const [addDisabled, setAddDisabled] = useState(true);
  const [editDisabled, setEditDisabled] = useState(true);
  const [resetCount, setResetCount] = useState(0);

  useEffect(() => {
    if (variant == "edit") {
      initialFormdataRef.current = { ...formdata };
    } else {
      initialFormdataRef.current = {};
    }

    setResetCount((prev) => prev + 1);
  }, [variant]);

  const scheduleDelayEnabled = formdata.enable_schedule_send === "true";
  const preferredTimeEnabled = formdata.enable_preferred_time === "true";

  const timeUnitOptions = ["Days", "Hours", "Minutes"];

  useEffect(() => {
    const requiredKeys = ["template_name", "subject", "message"];
    
    const hasRequiredKeys = requiredKeys.every((key) => formdata[key]);
    const requiredValues = requiredKeys.map((key) => formdata[key] || "");
    const allFilled = requiredValues.every((value) => Boolean(value?.trim()));

    if (variant === "add") {
      setAddDisabled(!(hasRequiredKeys && allFilled));
    }

    if (variant === "edit") {
      const hasInitialRequiredKeys = requiredKeys.every(
        (key) => initialFormdataRef.current[key]
      );
      const isChanged = requiredKeys.some(
        (key) =>
          (formdata[key]?.trim() || "") !==
          (initialFormdataRef.current[key]?.trim() || "")
      );
      
      // Check if any schedule or preferred time fields changed
      const scheduleFields = [
        "enable_schedule_send",
        "schedule_delay",
        "schedule_delay_unit",
        "enable_preferred_time",
        "preferred_time",
      ];
      const scheduleChanged = scheduleFields.some(
        (key) =>
          (formdata[key] || "") !== (initialFormdataRef.current[key] || "")
      );

      setEditDisabled(
        !(
          hasRequiredKeys &&
          hasInitialRequiredKeys &&
          allFilled &&
          (isChanged || scheduleChanged)
        )
      );
    }
  }, [formdata, variant]);

  return (
    <div className={`${styles.modal} ${isVisible ? styles.active : ""}`}>
      <div className={`${styles.modalContent} ${styles.manageTemplate}`}>
        <div className={styles.header}>
          <span>{variant == "add" ? "Add" : "Edit"} Template</span>
          <img alt="" src="/icons/x.svg" onClick={onClose} />
        </div>

        <Field
          formdata={formdata}
          label="Template Name"
          placeholder="Enter template name"
          onChange={onChange}
        />

        <Editor
          dropdownPosition="bottom"
          formdata={formdata}
          label="Subject"
          placeholder="Enter subject"
          toolbarItems={["insertToken"]}
          onChange={onChange}
          key={`subject-${resetCount}`}
        />

        <Editor
          formdata={formdata}
          height={225}
          label="Message"
          placeholder="Enter message"
          onChange={onChange}
          key={`message-${resetCount}`}
        />

        <div className={styles.scheduleField}>
          <div className={styles.scheduleHeader}>
            <span className={styles.scheduleLabel}>Schedule Sending (optional)</span>
            <div className={styles.toggleGroup}>
              <span className={styles.toggleLabel}>Enable schedule send</span>
              <Toggle
                checked={scheduleDelayEnabled}
                onChange={(checked) =>
                  onChange({
                    id: "enable_schedule_send",
                    value: checked ? "true" : "false",
                  })
                }
              />
            </div>
          </div>
          {scheduleDelayEnabled && (
            <>
              <div className={styles.scheduleInputs}>
                <input
                  type="number"
                  min="1"
                  value={formdata.schedule_delay || ""}
                  onChange={(e) =>
                    onChange({ id: "schedule_delay", value: e.target.value })
                  }
                  placeholder="E.g. 2"
                  className={styles.delayInput}
                />
                <Dropdown
                  dropdownItems={timeUnitOptions}
                  dropdownPosition="top"
                  label=""
                  placeholder="Days"
                  value={formdata.schedule_delay_unit || ""}
                  onSelect={(value) =>
                    onChange({ id: "schedule_delay_unit", value })
                  }
                />
              </div>
              <p className={styles.scheduleDescription}>
                Emails using this template will be sent after selected delay.
              </p>
            </>
          )}
        </div>

        <div className={styles.preferredTimeField}>
          <div className={styles.preferredTimeHeader}>
            <span className={styles.preferredTimeLabel}>
              Preferred Time (optional)
            </span>
            <div className={styles.toggleGroup}>
              <span className={styles.toggleLabel}>Enable preferred time</span>
              <Toggle
                checked={preferredTimeEnabled}
                onChange={(checked) =>
                  onChange({
                    id: "enable_preferred_time",
                    value: checked ? "true" : "false",
                  })
                }
              />
            </div>
          </div>
          {preferredTimeEnabled && (
            <input
              type="time"
              value={formdata.preferred_time || ""}
              onChange={(e) =>
                onChange({ id: "preferred_time", value: e.target.value })
              }
              className={styles.timeInput}
            />
          )}
        </div>

        <div className={styles.buttonGroup}>
          {variant == "add" && (
            <Button
              disabled={addDisabled}
              icon="/icons/plus.svg"
              label="Add template"
              onClick={onClick}
            />
          )}

          {variant == "edit" && (
            <>
              <Button label="Cancel" variant="secondary" onClick={onClose} />
              <Button
                disabled={editDisabled}
                label="Save Changes"
                onClick={onClick}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ManageTemplate);
