"use client";

import styles from "./modal.module.scss";
import { Button, Dropdown, Field } from "@/lib/components/ui";
import type {
  TemplateProps,
  EmailAutomationCardProps,
} from "@/lib/types/email.type";
import { useEffect, useState, useRef } from "react";
import Template from "../template/Template";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { defaultEmailAutomations } from "@/lib/data/emailAutomation";
import { api } from "@/lib/utils/apiClient";

interface IDProps {
  stage_id: string;
  substage_id: string;
  automation_id: string;
}

interface ManageAutomationProps {
  timelineStages: any[];
  activeID: IDProps;
  isVisible: boolean;
  templates: TemplateProps[];
  onClose: () => void;
  onSuccess?: () => void;
  existingAutomation?:
    | (EmailAutomationCardProps & { template?: TemplateProps | null })
    | null;
}

export default function ({
  timelineStages,
  activeID,
  isVisible,
  templates,
  onClose,
  onSuccess,
  existingAutomation,
}: ManageAutomationProps) {
  const router = useRouter();
  const { slug } = useParams();
  const careerId = slug as string;
  const [template, setTemplate] = useState<TemplateProps | null>(null);
  const [formdata, setFormdata] = useState({
    automation_name: "",
    trigger_on_event: "",
    reminder_delay: "",
    reminder_delay_unit: "",
    from_stage: "",
    to_stage: "",
    sender: "",
  });
  const hasInitialized = useRef(false);
  const prevIsVisible = useRef(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const automationIdRef = useRef<string>("");
  const [senderOptions, setSenderOptions] = useState<string[]>([
    "Job Creator",
    "User",
    "System",
  ]);

  function verify() {
    const token = localStorage.getItem("authToken");
    if (!token) {
      return "Your session has expired. Please sign in again.";
    }
    const activeOrg = localStorage.getItem("activeOrg");
    if (!activeOrg) {
      return "Failed to load organization information. Please check your session.";
    }

    try {
      const parsedOrg = JSON.parse(activeOrg);
      if (!parsedOrg._id) {
        return "Failed to load organization information. Please check your session.";
      }

      return { token, orgID: parsedOrg._id };
    } catch (err) {
      return "Failed to load organization information. Please check your session.";
    }
  }

  function handleSaveAutomation() {
    if (
      !formdata.automation_name ||
      !formdata.trigger_on_event ||
      !formdata.sender ||
      !template
    ) {
      alert("Please fill in all fields");
      return;
    }

    if (
      formdata.trigger_on_event === "Reminder" &&
      (!formdata.reminder_delay || !formdata.reminder_delay_unit)
    ) {
      alert(
        "Please set when the reminder email should be sent (delay and unit).",
      );
      return;
    }

    const result = verify();

    if (typeof result == "string") {
      alert(result);
      return;
    }

    const { orgID } = result;

    const user =
      typeof window !== "undefined"
        ? JSON.parse(localStorage.getItem("user") || "{}")
        : {};
    const creatorEmail = user?.email || "";

    // Get stage info from activeID
    const stage = timelineStages.find(
      (item) => item.stage_id === activeID.stage_id,
    );
    const substage = stage?.substages.find(
      (sub) => sub.substage_id === activeID.substage_id,
    );

    const activeStageInfo =
      stage && substage
        ? {
            stage_name: stage.stage_name,
            stage_id: stage.stage_id,
            substage_name: substage.substage_name,
            substage_id: substage.substage_id,
          }
        : null;

    // Get stage info from from_stage dropdown value
    const getStageInfoFromValue = (value: string) => {
      const [stageName, substageName] = value.split(": ").map((s) => s.trim());
      const foundStage = timelineStages.find(
        (item) => item.stage_name === stageName,
      );
      const foundSubstage = foundStage?.substages.find(
        (sub) => sub.substage_name === substageName,
      );
      return foundStage && foundSubstage
        ? {
            stage_name: foundStage.stage_name,
            stage_id: foundStage.stage_id,
            substage_name: foundSubstage.substage_name,
            substage_id: foundSubstage.substage_id,
          }
        : null;
    };

    const fromStageInfo = formdata.from_stage
      ? getStageInfoFromValue(formdata.from_stage)
      : null;
    const toStageInfo = formdata.to_stage
      ? getStageInfoFromValue(formdata.to_stage)
      : null;

    // Build automation object, ensuring all required fields are present
    const automationData = {
      automation_name: formdata.automation_name,
      trigger_on_event: formdata.trigger_on_event,
      sender: formdata.sender,
      active: isEditMode ? (existingAutomation?.active ?? true) : true,
      template_id: template?.template_id || "",
      from_stage: formdata.from_stage || "",
      to_stage: formdata.to_stage || "",
      creator_email: creatorEmail,
      ...(formdata.trigger_on_event === "Reminder" && {
        reminder_delay: formdata.reminder_delay,
        reminder_delay_unit: formdata.reminder_delay_unit,
      }),
    };

    const data = {
      ...activeStageInfo,
      orgID,
      careerId,
      automation: automationData,
    };

    // Use the stored automation ID from ref
    const automationIdToUpdate =
      automationIdRef.current || activeID.automation_id;

    if (isEditMode && automationIdToUpdate) {
      // Update existing automation
      api
        .put("/api/emails/automation", {
          ...data,
          automation_id: automationIdToUpdate,
        })
        .then((res) => {
          if (res.data.success) {
            onClose();
            onSuccess?.();
          } else {
            alert(res.data.error || "Failed to update automation");
          }
        })
        .catch((err) => {
          console.error("Error updating automation:", err);
          alert(
            err?.response?.data?.error ||
              "An unexpected error occurred. Please try again later.",
          );
        });
    } else {
      // Create new automation
      api
        .post("/api/emails/automation", data)
        .then((res) => {
          onClose();
          onSuccess?.();
        })
        .catch((err) => {
          console.error("Error creating automation:", err);
          alert(
            err?.response?.data?.error ||
              "An unexpected error occurred. Please try again later.",
          );
        });
    }
  }

  useEffect(() => {
    // Fetch Mailgun and Gmail accounts when modal opens
    if (isVisible && !prevIsVisible.current) {
      const fetchSenderAccounts = async () => {
        const token = localStorage.getItem("authToken");
        const activeOrg = localStorage.getItem("activeOrg");

        if (!token || !activeOrg) return;

        try {
          const parsedOrg = JSON.parse(activeOrg);
          const orgId = parsedOrg._id;
          const headers = { Authorization: `Bearer ${token}` };

          const [mailgunRes, gmailRes] = await Promise.all([
            axios.get(
              `/api/mailgun-module/mg-fetch-org-accounts?orgId=${orgId}`,
              { headers },
            ),
            axios.get(`/api/gmail/users?orgID=${orgId}`, { headers }),
          ]);

          const base = ["Job Creator", "User", "System"];
          const mailgunEmails = Array.isArray(mailgunRes.data?.accounts)
            ? mailgunRes.data.accounts.map((a: { email?: string }) => a.email).filter(Boolean)
            : [];
          const gmailEmails = Array.isArray(gmailRes.data?.result)
            ? gmailRes.data.result
                .map((item: { userDetails?: { email?: string } }) => item.userDetails?.email)
                .filter(Boolean)
            : [];

          setSenderOptions([...base, ...mailgunEmails, ...gmailEmails]);
        } catch (err) {
          console.error("Error fetching sender accounts (mailgun/gmail):", err);
        }
      };

      fetchSenderAccounts();
    }
  }, [isVisible]);

  useEffect(() => {
    // Only initialize when modal becomes visible (transitions from false to true)
    const justOpened = isVisible && !prevIsVisible.current;

    if (justOpened) {
      const isEdit = !!existingAutomation && !!activeID.automation_id;
      setIsEditMode(isEdit);

      if (isEdit && existingAutomation && activeID.automation_id) {
        // Store automation ID for save function
        automationIdRef.current = activeID.automation_id;

        // Pre-populate form for edit mode
        setFormdata({
          automation_name: existingAutomation.automation_name || "",
          trigger_on_event: existingAutomation.trigger_on_event || "",
          reminder_delay: existingAutomation.reminder_delay || "",
          reminder_delay_unit: existingAutomation.reminder_delay_unit || "",
          from_stage: existingAutomation.from_stage || "",
          to_stage: existingAutomation.to_stage || "",
          sender: existingAutomation.sender || "",
        });

        // Set template if it exists
        if (existingAutomation.template) {
          setTemplate(existingAutomation.template);
        } else if (existingAutomation.template_id && templates.length > 0) {
          const foundTemplate = templates.find(
            (t) => t.template_id === existingAutomation.template_id,
          );
          setTemplate(foundTemplate || null);
        } else {
          setTemplate(null);
        }
        hasInitialized.current = true;
      } else {
        // Reset form for create mode
        automationIdRef.current = "";
        setTemplate(null);
        setFormdata({
          automation_name: "",
          trigger_on_event: "",
          reminder_delay: "",
          reminder_delay_unit: "",
          from_stage: "",
          to_stage: "",
          sender: "System",
        });
        hasInitialized.current = true;
      }
    }

    // Reset when modal closes
    if (!isVisible && prevIsVisible.current) {
      hasInitialized.current = false;
      setIsEditMode(false);
      automationIdRef.current = "";
      // Clear form when modal closes
      setTemplate(null);
      setFormdata({
        automation_name: "",
        trigger_on_event: "",
        reminder_delay: "",
        reminder_delay_unit: "",
        from_stage: "",
        to_stage: "",
        sender: "System",
      });
      setSenderOptions(["Job Creator", "User", "System"]);
    }

    prevIsVisible.current = isVisible;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  // Separate effect to update template when templates array is loaded (only if not already set)
  useEffect(() => {
    if (
      isVisible &&
      existingAutomation &&
      activeID.automation_id &&
      !template &&
      templates.length > 0
    ) {
      if (existingAutomation.template_id) {
        const foundTemplate = templates.find(
          (t) => t.template_id === existingAutomation.template_id,
        );
        if (foundTemplate) {
          setTemplate(foundTemplate);
        }
      }
    }
  }, [
    templates,
    isVisible,
    existingAutomation,
    activeID.automation_id,
    template,
  ]);

  return (
    <div className={`${styles.modal} ${isVisible ? styles.active : ""}`}>
      <div className={`${styles.modalContent} ${styles.manageAutomation}`}>
        <div className={styles.header}>
          <span>
            {isEditMode ? "Edit Automation" : "Create New Automation"}
          </span>
          <img alt="" src="/icons/x.svg" onClick={onClose} />
        </div>

        <div className={styles.contentGroup}>
          <div className={styles.fieldGroup}>
            <Field
              formdata={formdata}
              label="Automation Name"
              placeholder="Enter name"
              onChange={({ id, value }) => {
                setFormdata((prev) => ({ ...prev, [id]: value }));
              }}
            />

            <Dropdown
              dropdownItems={templates.map((item) => item.template_name)}
              label="Email Template"
              placeholder="Select Template"
              value={template?.template_name || ""}
              onSelect={(value) => {
                const template = templates.find(
                  (template) => template.template_name == value,
                );
                setTemplate(template || null);
              }}
            />

            <div className={styles.button}>
              <Button
                icon="/icons/arrow.svg"
                label="Go to email templates"
                variant="secondary"
                onClick={() => {
                  router.push(
                    `/recruiter-dashboard/settings/email-templates?tab=user`,
                  );
                }}
              />
            </div>

            <Dropdown
              dropdownItems={["Applied", "Endorse", "Drop", "Reminder"]}
              label="Trigger on Event"
              placeholder="Select trigger"
              value={formdata.trigger_on_event || ""}
              onSelect={(value) => {
                setFormdata((prev) => ({ ...prev, trigger_on_event: value }));
              }}
            />

            {formdata.trigger_on_event === "Reminder" && (
              <div className={styles.reminderGroup}>
                <div className={styles.reminderRow}>
                  <div className={styles.reminderField}>
                    <span>Send after</span>
                    <input
                      type="number"
                      min={1}
                      placeholder="e.g. 1"
                      value={formdata.reminder_delay || ""}
                      onChange={(e) =>
                        setFormdata((prev) => ({
                          ...prev,
                          reminder_delay: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <Dropdown
                    dropdownItems={["Minutes", "Hours", "Days"]}
                    label="Unit"
                    placeholder="Select unit"
                    value={formdata.reminder_delay_unit || ""}
                    onSelect={(value) => {
                      setFormdata((prev) => ({
                        ...prev,
                        reminder_delay_unit: value,
                      }));
                    }}
                  />
                </div>
                <p className={styles.reminderDescription}>
                  Choose when this email should be sent after it&apos;s
                  triggered. Exact send date will be determined automatically.
                </p>
              </div>
            )}

            {formdata.trigger_on_event !== "Reminder" && (
              <div className={styles.stageGroup}>
                <Dropdown
                  dropdownItems={timelineStages.flatMap((item) =>
                    item.substages.map(
                      (substage) =>
                        `${item.stage_name}: ${substage.substage_name}`,
                    ),
                  )}
                  label="From Stage"
                  placeholder="Select from"
                  value={formdata.from_stage || ""}
                  onSelect={(value) => {
                    setFormdata((prev) => ({ ...prev, from_stage: value }));
                  }}
                />

                <Dropdown
                  dropdownItems={timelineStages
                    .filter((item) => item.stage_id == activeID.stage_id)
                    .flatMap((item) => {
                      const substage = item.substages.find(
                        (s) => s.substage_id == activeID.substage_id,
                      );
                      return substage
                        ? [`${item.stage_name}: ${substage.substage_name}`]
                        : [];
                    })}
                  label="To Stage"
                  placeholder="Select to"
                  value={formdata.to_stage || ""}
                  onSelect={(value) => {
                    setFormdata((prev) => ({ ...prev, to_stage: value }));
                  }}
                />
              </div>
            )}

            <Dropdown
              dropdownItems={senderOptions}
              label="Sender"
              placeholder="Select sender"
              value={formdata.sender || ""}
              onSelect={(value) => {
                setFormdata((prev) => ({ ...prev, sender: value }));
              }}
            />
          </div>

          <div className={styles.templateGroup}>
            <span className={styles.label}>Email Template Preview</span>
            {template && (
              <Template subject={template.subject} message={template.message} />
            )}
          </div>
        </div>

        <div className={styles.buttonGroup}>
          <Button label="Cancel" variant="secondary" onClick={onClose} />
          <Button
            label={isEditMode ? "Update Automation" : "Create Automation"}
            onClick={handleSaveAutomation}
          />
        </div>
      </div>
    </div>
  );
}
