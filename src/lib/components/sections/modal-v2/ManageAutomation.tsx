"use client";

import EditTemplate from "./EditTemplate";
import styles from "./modal.module.scss";
import { TemplateV2 } from "@/lib/components/sections";
import { ButtonV2, DropdownV2, FieldV2, ToggleV2 } from "@/lib/components/ui";
import type {
  EmailAutomationCardProps,
  TemplateProps,
} from "@/lib/types/email.type";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/utils/apiClient";

interface ManageAutomationProps {
  activeID: {
    stage_id: string;
    substage_id: string;
    automation_id: string;
  };
  careerId?: string;
  isVisible: boolean;
  timelineStages: any[];
  templates: TemplateProps[];
  existingAutomation?:
    | (EmailAutomationCardProps & { template?: TemplateProps | null })
    | null;
  onClose: () => void;
  onSuccess?: () => void | Promise<void>;
  onTemplatesRefresh?: () => Promise<TemplateProps[] | null>;
}

interface InitProps {
  id: string;
  isOptional?: boolean;
}

interface SenderOption {
  value: string;
  label: string;
  description?: string;
  avatarImage?: string;
  avatarText: string;
  avatarTone: "blue" | "pink" | "green" | "orange" | "purple" | "gray";
  searchText?: string;
}

const initialFormState = {
  automation_name: "",
  trigger_on: "",
  send_after: "",
  unit: "",
  from_stage: "",
  to_stage: "",
  email_template: "",
  sender: "System",
};

const initialTemplateEditorState = {
  template_name: "",
  subject: "",
  message: "",
  enable_schedule_send: "false",
  schedule_delay: "",
  schedule_delay_unit: "Days",
  enable_preferred_time: "false",
  preferred_time: "",
};

const triggerOptions = [
  { icon: "/figma-assets/email-automation/trigger-applied.svg", label: "Applied", value: "Applied" },
  { icon: "/figma-assets/email-automation/trigger-applied.svg", label: "Invited", value: "Invited" },
  { icon: "/figma-assets/email-automation/trigger-endorse.svg", label: "Endorse", value: "Endorse" },
  { icon: "/figma-assets/email-automation/trigger-drop.svg", label: "Drop", value: "Drop" },
  { icon: "/figma-assets/email-automation/trigger-reminder.svg", label: "Reminder", value: "Reminder" },
];

const reminderUnitOptions = [
  { value: "Minutes" },
  { value: "Hours" },
  { value: "Days" },
];

const avatarTones = ["blue", "pink", "green", "orange", "purple"] as const;
const templateTagToneByType = {
  user: "blue",
  global: "pink",
  system: "gray",
} as const;

function toTitleCase(value: string) {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getInitials(value: string) {
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getAvatarTone(value: string): SenderOption["avatarTone"] {
  const hash = value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarTones[hash % avatarTones.length];
}

function buildSenderOption(
  value: string,
  options?: { avatarImage?: string; description?: string; label?: string },
): SenderOption {
  const isEmail = value.includes("@");
  const label =
    options?.label ||
    (value === "System"
      ? "System"
      : isEmail
        ? toTitleCase(value.split("@")[0].replace(/[+]/g, " "))
        : value);
  const description =
    options?.description ||
    (value === "System" ? "<noreply@hellojia.ai>" : isEmail ? `<${value}>` : "");

  return {
    value,
    label,
    description,
    avatarImage: value === "System" ? "/jia-dashboard-logo.png" : options?.avatarImage,
    avatarText: getInitials(label),
    avatarTone: getAvatarTone(value),
    searchText: `${label} ${description} ${value}`.trim(),
  };
}

function buildTemplateEditorState(template?: TemplateProps | null) {
  return {
    template_name: template?.template_name || "",
    subject: template?.subject || "",
    message: template?.message || "",
    // always start OFF so the user opts-in deliberately
    enable_schedule_send: "false",
    schedule_delay: template?.schedule_delay || "",
    schedule_delay_unit: template?.schedule_delay_unit || "Days",
    enable_preferred_time: "false",
    preferred_time: template?.preferred_time || "",
  };
}

export default memo(function ManageAutomation({
  activeID,
  careerId: careerIdProp,
  isVisible,
  timelineStages,
  templates,
  existingAutomation,
  onClose,
  onSuccess,
  onTemplatesRefresh,
}: ManageAutomationProps) {
  const router = useRouter();
  const { slug } = useParams();
  const careerId = careerIdProp || String(slug || "");
  const isEditMode = Boolean(existingAutomation && activeID.automation_id);
  const [errordata, setErrordata] = useState<Record<string, string>>({});
  const [formdata, setFormdata] =
    useState<Record<string, string>>(initialFormState);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateProps | null>(
    null,
  );
  const [availableTemplates, setAvailableTemplates] = useState<TemplateProps[]>(templates);
  const [isTemplateEditorVisible, setIsTemplateEditorVisible] = useState(false);
  const [templateEditorResetKey, setTemplateEditorResetKey] = useState(0);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [applyChangesToBaseTemplate, setApplyChangesToBaseTemplate] = useState(false);
  const [templateEditorFormdata, setTemplateEditorFormdata] =
    useState<Record<string, string>>(initialTemplateEditorState);
  const [templateEditorInitialState, setTemplateEditorInitialState] =
    useState<Record<string, string>>(initialTemplateEditorState);
  const [previewWithSample, setPreviewWithSample] = useState(false);
  const [isLoadingSenderOptions, setIsLoadingSenderOptions] = useState(false);
  const [senderOptions, setSenderOptions] = useState<SenderOption[]>([
    buildSenderOption("System"),
  ]);

  const currentStageValue = useMemo(() => {
    const stage = timelineStages.find(
      (item) => item.stage_id === activeID.stage_id,
    );
    const substage = stage?.substages.find(
      (item: any) => item.substage_id === activeID.substage_id,
    );

    if (!stage || !substage) {
      return "";
    }

    return `${stage.stage_name}: ${substage.substage_name}`;
  }, [activeID.stage_id, activeID.substage_id, timelineStages]);
  const templatesPath = "/recruiter-dashboard/settings/email-templates?tab=user";
  const currentUser = useMemo(() => {
    if (typeof window === "undefined") {
      return {};
    }

    try {
      return JSON.parse(localStorage.getItem("user") || "{}") || {};
    } catch {
      return {};
    }
  }, [isVisible]);
  const currentUserEmail = useMemo(() => {
    return String((currentUser as { email?: string })?.email || "").toLowerCase();
  }, [currentUser]);

  const previousStageOptions = useMemo(() => {
    const flattenedStages = timelineStages.flatMap((stage, stageIndex) =>
      stage.substages.map((substage: any, substageIndex: number) => ({
        stage_id: stage.stage_id,
        substage_id: substage.substage_id,
        stageIndex,
        substageIndex,
        value: `${stage.stage_name}: ${substage.substage_name}`,
      })),
    );

    const currentStage = flattenedStages.find(
      (item) =>
        item.stage_id === activeID.stage_id && item.substage_id === activeID.substage_id,
    );

    const stageItems = (currentStage
      ? flattenedStages.filter(
          (item) =>
            item.stageIndex < currentStage.stageIndex ||
            (item.stageIndex === currentStage.stageIndex &&
              item.substageIndex < currentStage.substageIndex),
        )
      : flattenedStages
    ).map(({ value }) => ({ value }));

    return [{ value: "Any stage" }, ...stageItems];
  }, [activeID.stage_id, activeID.substage_id, timelineStages]);

  const templateOptions = useMemo(
    () =>
      availableTemplates
        .filter((template) => {
          if (template.is_copy) return false;

          const normalizedType = String(template.type).toLowerCase();

          if (normalizedType === "system" || normalizedType === "global") {
            return true;
          }

          if (normalizedType !== "user") {
            return false;
          }

          return (
            Boolean(currentUserEmail) &&
            String(template.creator?.email || "").toLowerCase() === currentUserEmail
          );
        })
        .map((template) => {
          const normalizedType =
            String(template.type).toLowerCase() as keyof typeof templateTagToneByType;

          return {
            value: template.template_id,
            label: template.template_name,
            group: normalizedType,
            searchText: `${template.template_name} ${normalizedType}`,
            tag: normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1),
            tagTone: templateTagToneByType[normalizedType],
          };
        }),
    [availableTemplates, currentUserEmail],
  );

  const senderDropdownOptions = useMemo(() => senderOptions, [senderOptions]);
  const templateType = useMemo(() => {
    if (!selectedTemplate?.type) return "";

    const value = String(selectedTemplate.type);
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }, [selectedTemplate?.type]);
  const showCreateDetails = useMemo(
    () => isEditMode || Boolean(formdata.trigger_on),
    [formdata.trigger_on, isEditMode],
  );
  const canEditSelectedTemplate = useMemo(() => {
    if (!selectedTemplate) return false;

    return (
      String(selectedTemplate.type || "").toLowerCase() === "user" &&
      String(selectedTemplate.creator?.email || "").toLowerCase() === currentUserEmail
    );
  }, [currentUserEmail, selectedTemplate]);
  const templateEditButtonTooltip = canEditSelectedTemplate
    ? ""
    : "Only your own user templates can be edited.";
  const templateEditorSaveDisabled = useMemo(() => {
    const requiredKeys = ["template_name", "subject", "message"];
    const hasRequiredValues = requiredKeys.every((key) =>
      Boolean(templateEditorFormdata[key]?.trim()),
    );

    if (!hasRequiredValues) {
      return true;
    }

    // When creating a copy (toggle off), only require fields to be filled
    if (!applyChangesToBaseTemplate) {
      return false;
    }

    const keysToCompare = [
      "template_name",
      "subject",
      "message",
      "enable_schedule_send",
      "schedule_delay",
      "schedule_delay_unit",
      "enable_preferred_time",
      "preferred_time",
    ];

    return !keysToCompare.some(
      (key) =>
        String(templateEditorFormdata[key] || "") !==
        String(templateEditorInitialState[key] || ""),
    );
  }, [templateEditorFormdata, templateEditorInitialState]);

  const handleInit = useCallback(({ id, isOptional }: InitProps) => {
    if (isOptional) return;

    setErrordata((prev) => {
      if (id in prev) return prev;
      return { ...prev, [id]: "" };
    });
  }, []);

  const clearError = useCallback((id: string) => {
    setErrordata((prev) => {
      if (!(id in prev)) return prev;

      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

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
    } catch (error) {
      return "Failed to load organization information. Please check your session.";
    }
  }

  const handleOnChange = useCallback(
    ({ id, value }: { id: string; value: string }) => {
      setFormdata((prev) => {
        const next = { ...prev, [id]: value };

        if (id === "trigger_on") {
          if (value === "Endorse") {
            next.to_stage = currentStageValue;
            next.from_stage = "Any stage";
            next.send_after = "";
            next.unit = "";
          } else if (value === "Drop") {
            next.from_stage = currentStageValue;
            next.to_stage = "";
            next.send_after = "";
            next.unit = "";
          } else if (value === "Reminder") {
            next.from_stage = "";
            next.to_stage = "";
          } else {
            next.from_stage = "";
            next.to_stage = currentStageValue;
            next.send_after = "";
            next.unit = "";
          }
        }

        if (id === "email_template") {
          const template =
            availableTemplates.find((item) => item.template_id === value) || null;
          setSelectedTemplate(template);
        }

        return next;
      });

      if (id === "trigger_on") {
        setErrordata((prev) => {
          const next = { ...prev };
          delete next.from_stage;
          delete next.to_stage;
          delete next.send_after;
          delete next.unit;
          delete next.email_template;
          delete next.sender;
          return next;
        });
      }

      if (value.trim()) {
        clearError(id);
      }
    },
    [availableTemplates, clearError, currentStageValue],
  );

  const handleTemplateEditorChange = useCallback(
    ({ id, value }: { id: string; value: string }) => {
      setTemplateEditorFormdata((prev) => ({ ...prev, [id]: value }));
    },
    [],
  );

  const handleOpenTemplateEditor = useCallback(() => {
    if (!selectedTemplate || !canEditSelectedTemplate) {
      return;
    }

    const nextState = buildTemplateEditorState(selectedTemplate);
    setTemplateEditorInitialState(nextState);
    setTemplateEditorFormdata(nextState);
    setApplyChangesToBaseTemplate(false);
    setTemplateEditorResetKey((prev) => prev + 1);
    setIsTemplateEditorVisible(true);
  }, [canEditSelectedTemplate, selectedTemplate]);

  const handleBackFromTemplateEditor = useCallback(() => {
    setIsTemplateEditorVisible(false);
    setIsSavingTemplate(false);
  }, []);

  const handleSaveTemplateChanges = useCallback(async () => {
    if (!selectedTemplate || !canEditSelectedTemplate || isSavingTemplate) {
      return;
    }

    const result = verify();
    if (typeof result === "string") {
      alert(result);
      return;
    }

    try {
      setIsSavingTemplate(true);

      const payload = {
        orgID: result.orgID,
        template_name: templateEditorFormdata.template_name.trim(),
        subject: templateEditorFormdata.subject.trim(),
        message: templateEditorFormdata.message.trim(),
        enable_schedule_send:
          templateEditorFormdata.enable_schedule_send === "true" ? "true" : "false",
        schedule_delay:
          templateEditorFormdata.enable_schedule_send === "true"
            ? templateEditorFormdata.schedule_delay || ""
            : "",
        schedule_delay_unit:
          templateEditorFormdata.enable_schedule_send === "true"
            ? templateEditorFormdata.schedule_delay_unit || "Days"
            : "",
        enable_preferred_time:
          templateEditorFormdata.enable_preferred_time === "true" ? "true" : "false",
        preferred_time:
          templateEditorFormdata.enable_preferred_time === "true"
            ? templateEditorFormdata.preferred_time || ""
            : "",
      };

      let nextTemplate: TemplateProps;

      if (applyChangesToBaseTemplate) {
        const response = await api.patch("/api/emails/templates", {
          ...payload,
          templateID: selectedTemplate.template_id,
        });

        nextTemplate = {
          ...selectedTemplate,
          ...payload,
          date_updated:
            response.data?.data?.dateUpdated || new Date().toString(),
        } as TemplateProps;
      } else {
        const response = await api.post("/api/emails/templates", {
          ...payload,
          type: "User",
          is_copy: true,
        });

        nextTemplate = {
          ...payload,
          template_id: response.data?.data?.template_id,
          date_updated:
            response.data?.data?.date_updated || new Date().toString(),
          creator: {
            email: currentUserEmail,
            id: String((currentUser as { _id?: string })?._id || ""),
            name: String((currentUser as { name?: string })?.name || "You"),
            picture: String(
              (currentUser as { picture?: string; image?: string })?.picture ||
                (currentUser as { picture?: string; image?: string })?.image ||
                "",
            ),
            role: String((currentUser as { role?: string })?.role || "user"),
          },
          type: "user",
        } as TemplateProps;
      }

      setAvailableTemplates((prev) => {
        if (applyChangesToBaseTemplate) {
          return prev.map((item) =>
            item.template_id === nextTemplate.template_id ? nextTemplate : item,
          );
        }

        return [...prev, nextTemplate];
      });

      setSelectedTemplate(nextTemplate);
      setFormdata((prev) => ({
        ...prev,
        email_template: nextTemplate.template_id,
      }));
      setTemplateEditorInitialState(buildTemplateEditorState(nextTemplate));
      setTemplateEditorFormdata(buildTemplateEditorState(nextTemplate));
      setIsTemplateEditorVisible(false);
      await onTemplatesRefresh?.();
    } catch (error: any) {
      alert(
        error?.response?.data?.error ||
          error?.message ||
          "An unexpected error occurred. Please try again later.",
      );
    } finally {
      setIsSavingTemplate(false);
    }
  }, [
    applyChangesToBaseTemplate,
    canEditSelectedTemplate,
    currentUser,
    currentUserEmail,
    isSavingTemplate,
    onTemplatesRefresh,
    selectedTemplate,
    templateEditorFormdata,
  ]);

  const handleManage = useCallback(async () => {
    const requiredFields = ["automation_name", "trigger_on"];
    if (formdata.trigger_on) {
      requiredFields.push("email_template", "sender");
    }
    if (formdata.trigger_on === "Reminder") {
      requiredFields.push("send_after", "unit");
    }

    const nextErrors = requiredFields.reduce<Record<string, string>>(
      (acc, field) => {
        if (!formdata[field]?.trim()) {
          acc[field] = "This is a required field.";
        }
        return acc;
      },
      {},
    );

    setErrordata(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    if (!selectedTemplate) {
      setErrordata((prev) => ({
        ...prev,
        email_template: "This is a required field.",
      }));
      return;
    }

    const result = verify();
    if (typeof result === "string") {
      alert(result);
      return;
    }

    const { orgID } = result;
    const user =
      typeof window !== "undefined"
        ? JSON.parse(localStorage.getItem("user") || "{}")
        : {};
    const creatorEmail = user?.email || "";
    const stage = timelineStages.find(
      (item) => item.stage_id === activeID.stage_id,
    );
    const substage = stage?.substages.find(
      (item: any) => item.substage_id === activeID.substage_id,
    );

    if (!stage || !substage) {
      alert("Unable to find the selected stage.");
      return;
    }

    const automation = {
      automation_name: formdata.automation_name,
      trigger_on_event: formdata.trigger_on,
      sender: formdata.sender,
      active: isEditMode ? Boolean(existingAutomation?.active) : true,
      template_id: selectedTemplate.template_id,
      from_stage: formdata.from_stage === "Any stage" ? "" : (formdata.from_stage || ""),
      to_stage: formdata.to_stage || "",
      creator_email: creatorEmail,
      reminder_delay: formdata.trigger_on === "Reminder" ? formdata.send_after : "",
      reminder_delay_unit: formdata.trigger_on === "Reminder" ? formdata.unit : "",
    };

    const payload = {
      orgID,
      careerId,
      stage_id: stage.stage_id,
      stage_name: stage.stage_name,
      substage_id: substage.substage_id,
      substage_name: substage.substage_name,
      automation,
    };

    try {
      if (isEditMode) {
        const response = await api.put("/api/emails/automation", {
          ...payload,
          automation_id: activeID.automation_id,
        });

        if (!response.data?.success) {
          throw new Error(response.data?.error || "Failed to update automation");
        }
      } else {
        const response = await api.post("/api/emails/automation", payload);

        if (!response.data?.success) {
          throw new Error(response.data?.error || "Failed to create automation");
        }
      }

      onClose();
      await onSuccess?.();
    } catch (error: any) {
      alert(
        error?.response?.data?.error ||
          error?.message ||
          "An unexpected error occurred. Please try again later.",
      );
    }
  }, [
    activeID.automation_id,
    activeID.stage_id,
    activeID.substage_id,
    careerId,
    existingAutomation?.active,
    formdata,
    isEditMode,
    onClose,
    onSuccess,
    selectedTemplate,
    timelineStages,
  ]);

  useEffect(() => {
    setAvailableTemplates(templates);
  }, [templates]);

  useEffect(() => {
    if (!isVisible) {
      setErrordata({});
      setFormdata(initialFormState);
      setIsLoadingSenderOptions(false);
      setIsSavingTemplate(false);
      setIsTemplateEditorVisible(false);
      setApplyChangesToBaseTemplate(false);
      setSelectedTemplate(null);
      setTemplateEditorFormdata(initialTemplateEditorState);
      setTemplateEditorInitialState(initialTemplateEditorState);
      setPreviewWithSample(false);
      setSenderOptions([
        buildSenderOption("System"),
      ]);
      return;
    }

    const template =
      existingAutomation?.template ||
      availableTemplates.find((item) => item.template_id === existingAutomation?.template_id) ||
      null;

    setSelectedTemplate(template);
    setFormdata({
      automation_name: existingAutomation?.automation_name || "",
      trigger_on: existingAutomation?.trigger_on_event || "",
      send_after: existingAutomation?.reminder_delay || "",
      unit: existingAutomation?.reminder_delay_unit || "",
      from_stage:
        existingAutomation?.trigger_on_event === "Drop"
          ? existingAutomation?.from_stage || currentStageValue
          : existingAutomation?.trigger_on_event === "Endorse"
            ? existingAutomation?.from_stage || "Any stage"
            : existingAutomation?.from_stage || "",
      to_stage:
        existingAutomation?.trigger_on_event === "Endorse" ||
        existingAutomation?.trigger_on_event === "Applied"
          ? existingAutomation?.to_stage || currentStageValue
          : existingAutomation?.to_stage || "",
      email_template: template?.template_id || "",
      sender: existingAutomation?.sender || "System",
    });
  }, [currentStageValue, existingAutomation, isVisible]);

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

  useEffect(() => {
    if (!isVisible) return;

    const fetchSenderAccounts = async () => {
      const token = localStorage.getItem("authToken");
      const activeOrg = localStorage.getItem("activeOrg");

      if (!token || !activeOrg) return;

      try {
        setIsLoadingSenderOptions(true);
        const parsedOrg = JSON.parse(activeOrg);
        const orgId = parsedOrg._id;
        const headers = { Authorization: `Bearer ${token}` };

        const [mailgunRes, gmailRes, membersRes] = await Promise.all([
          axios.get(
            `/api/mailgun-module/mg-fetch-org-accounts?orgId=${orgId}`,
            { headers },
          ),
          axios.get(`/api/gmail/users?orgID=${orgId}`, { headers }),
          axios.post(`/api/fetch-members`, { orgID: orgId }, { headers }),
        ]);

        const membersByEmail = new Map<
          string,
          { image?: string; name?: string }
        >();

        if (Array.isArray(membersRes.data)) {
          membersRes.data.forEach(
            (member: { email?: string; image?: string; name?: string }) => {
              if (!member.email) return;
              membersByEmail.set(member.email.toLowerCase(), {
                image: member.image,
                name: member.name,
              });
            },
          );
        }

        const nextOptions = new Map<string, SenderOption>();
        [buildSenderOption("System")].forEach((item) => nextOptions.set(item.value, item));

        if (Array.isArray(mailgunRes.data?.accounts)) {
          mailgunRes.data.accounts.forEach(
            (item: {
              displayName?: string;
              email?: string;
              image?: string;
              name?: string;
              sender_name?: string;
            }) => {
              if (!item.email) return;
              const member = membersByEmail.get(item.email.toLowerCase());
              nextOptions.set(
                item.email,
                buildSenderOption(item.email, {
                  avatarImage: item.image || member?.image,
                  label:
                    item.displayName || item.name || item.sender_name || member?.name,
                }),
              );
            },
          );
        }

        if (Array.isArray(gmailRes.data?.result)) {
          gmailRes.data.result.forEach(
            (item: {
              userDetails?: { email?: string; image?: string; name?: string };
            }) => {
              const email = item.userDetails?.email;
              if (!email) return;
              const member = membersByEmail.get(email.toLowerCase());
              nextOptions.set(
                email,
                buildSenderOption(email, {
                  avatarImage: item.userDetails?.image || member?.image,
                  label: item.userDetails?.name || member?.name,
                }),
              );
            },
          );
        }

        setSenderOptions(Array.from(nextOptions.values()));
      } catch (error) {
        console.error("Error fetching sender accounts:", error);
      } finally {
        setIsLoadingSenderOptions(false);
      }
    };

    fetchSenderAccounts();
  }, [isVisible]);

  return (
    <>
      <div
        className={`${styles.modal} ${isVisible && !isTemplateEditorVisible ? styles.active : ""}`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className={`${styles.modalContent} ${styles.manageAutomation} ${
            isEditMode ? styles.editMode : ""
          }`}
          data-dropdown-root="true"
          onMouseDown={(event) => event.stopPropagation()}
        >
        <div className={styles.headerGroup}>
          <div className={`${styles.icon} ${!isEditMode ? styles.illustrationIcon : ""}`}>
            {isEditMode ? (
              <img alt="" src="/figma-assets/email-automation/edit-01.svg" />
            ) : (
              <img
                alt=""
                className={styles.headerIllustration}
                src="/figma-assets/email-automation/manage-header-create.svg"
              />
            )}
          </div>
          <div className={styles.textGroup}>
            <span className={styles.value}>
              {isEditMode ? "Edit automation" : "Create new automation"}
            </span>
            <span className={styles.label}>
              {isEditMode
                ? existingAutomation?.automation_name || "Update this automation"
                : "Automate your emails based on action triggers"}
            </span>
          </div>
          <button className={styles.close} type="button" onClick={onClose}>
            <img alt="" src="/icons/x.svg" />
          </button>
        </div>

        <div className={styles.contentGroup}>
          <FieldV2
            errordata={errordata}
            formdata={formdata}
            handleInit={handleInit}
            handleOnChange={handleOnChange}
            id="automation_name"
            label="Automation Name"
            placeholder="Enter automation name"
          />

          <DropdownV2
            dropdown={triggerOptions}
            errordata={errordata}
            formdata={formdata}
            handleInit={handleInit}
            handleOnChange={handleOnChange}
            id="trigger_on"
            label="Trigger on"
            placeholder="Select trigger"
          />

          {showCreateDetails && formdata.trigger_on === "Endorse" && (
            <div className={styles.triggerGroup}>
              <img
                alt=""
                className={styles.arrowIcon}
                src="/figma-assets/email-automation/corner-down-right.svg"
              />

              <div className={styles.triggerFields}>
                <DropdownV2
                  dropdown={previousStageOptions}
                  errordata={errordata}
                  formdata={formdata}
                  handleInit={handleInit}
                  handleOnChange={handleOnChange}
                  id="from_stage"
                  isOptional={true}
                  label="From Stage"
                  placeholder="Any stage"
                />

                <FieldV2
                  disabled={true}
                  errordata={errordata}
                  formdata={formdata}
                  handleInit={handleInit}
                  handleOnChange={handleOnChange}
                  id="to_stage"
                  isOptional={true}
                  label="To Stage"
                  placeholder={currentStageValue}
                  tooltip={{
                    message:
                      "To create an automation for another sub-stage, add it in that sub-stage.",
                    width: 286,
                  }}
                />
              </div>
            </div>
          )}

          {showCreateDetails && formdata.trigger_on === "Drop" && (
            <div className={styles.triggerGroup}>
              <img
                alt=""
                className={styles.arrowIcon}
                src="/figma-assets/email-automation/corner-down-right.svg"
              />

              <div className={styles.triggerFields}>
                <FieldV2
                  disabled={true}
                  errordata={errordata}
                  formdata={formdata}
                  handleInit={handleInit}
                  handleOnChange={handleOnChange}
                  id="from_stage"
                  isOptional={true}
                  label="From Stage"
                  placeholder={currentStageValue}
                  tooltip={{
                    message:
                      "To create an automation for another sub-stage, add it in that sub-stage.",
                    width: 286,
                  }}
                />
              </div>
            </div>
          )}

          {showCreateDetails && formdata.trigger_on === "Reminder" && (
            <div className={styles.triggerGroup}>
              <img
                alt=""
                className={styles.arrowIcon}
                src="/figma-assets/email-automation/corner-down-right.svg"
              />

              <div className={styles.triggerFields}>
                <FieldV2
                  errordata={errordata}
                  formdata={formdata}
                  handleInit={handleInit}
                  handleOnChange={handleOnChange}
                  id="send_after"
                  label="Send after"
                  placeholder="e.g. 1"
                />

                <DropdownV2
                  dropdown={reminderUnitOptions}
                  errordata={errordata}
                  formdata={formdata}
                  handleInit={handleInit}
                  handleOnChange={handleOnChange}
                  id="unit"
                  label="Unit"
                  placeholder="Select unit"
                />
              </div>
            </div>
          )}

          {showCreateDetails && (
            <>
              <div className={styles.templateGroup}>
                <DropdownV2
                  dropdown={templateOptions}
                  errordata={errordata}
                  filterTabs={[
                    { label: "All", value: "all" },
                    { label: "User", value: "user" },
                    { label: "Global", value: "global" },
                    { label: "System", value: "system" },
                  ]}
                  footerAction={{
                    icon: "/figma-assets/email-automation/plus.svg",
                    label: "Create new template",
                    onClick: () => window.open(templatesPath, "_blank", "noopener,noreferrer"),
                  }}
                  formdata={formdata}
                  handleInit={handleInit}
                  handleOnChange={handleOnChange}
                  id="email_template"
                  label="Email Template"
                  menuTitle="Email Templates"
                  placeholder="Select template"
                  selectedLabelOverride={selectedTemplate?.template_name}
                  searchPlaceholder="Search"
                  showSearch={true}
                  showSelectedIcon={false}
                />

                <div className={styles.templateButton}>
                  <ButtonV2
                    icon="/icons/external-link.svg"
                    iconPosition="right"
                    label="Templates"
                    variant="secondary"
                    onClick={() => window.open(templatesPath, "_blank", "noopener,noreferrer")}
                  />
                </div>
              </div>

              {selectedTemplate && (
                <div className={styles.templatePreviewRow}>
                  <img
                    alt=""
                    className={styles.arrowIcon}
                    src="/figma-assets/email-automation/corner-down-right.svg"
                  />
                  <div className={styles.templatePreviewGroup}>
                    <div className={styles.templateHeader}>
                      <div className={styles.templateMeta}>
                        <span className={styles.name}>{selectedTemplate.template_name}</span>
                        {templateType && <span className={styles.type}>{templateType}</span>}
                      </div>
                      <button
                        aria-disabled={!canEditSelectedTemplate}
                        aria-label={
                          canEditSelectedTemplate
                            ? "Edit template"
                            : "Only your own user templates can be edited."
                        }
                        className={`${styles.templateIconButton} ${
                          !canEditSelectedTemplate ? styles.disabled : ""
                        }`}
                        data-tooltip={templateEditButtonTooltip}
                        type="button"
                        onClick={handleOpenTemplateEditor}
                      >
                        <img alt="" src="/figma-assets/email-automation/edit-01.svg" />
                      </button>
                    </div>

                    <div className={styles.templateWrapper}>
                      <TemplateV2
                        message={selectedTemplate.message}
                        previewWithSample={previewWithSample}
                        subject={selectedTemplate.subject}
                      />
                    </div>

                    <span className={styles.previewToggle}>
                      <ToggleV2
                        checked={previewWithSample}
                        onChange={setPreviewWithSample}
                      />
                      Preview with sample values
                    </span>
                  </div>
                </div>
              )}

              <DropdownV2
                dropdown={senderDropdownOptions}
                errordata={errordata}
                formdata={formdata}
                handleInit={handleInit}
                handleOnChange={handleOnChange}
                id="sender"
                isLoading={isLoadingSenderOptions}
                label="Sender"
                loadingText="Loading sender details..."
                placeholder="Select sender"
                searchPlaceholder="Search"
                avatarMetaLayout="inline"
                selectedDisplay="avatar"
                showSearch={true}
                showSelectedIcon={false}
              />
            </>
          )}
        </div>

        <div className={styles.buttonGroup}>
          <ButtonV2 label="Cancel" variant="secondary" onClick={onClose} />
          <ButtonV2
            label={isEditMode ? "Save" : "Create"}
            onClick={handleManage}
          />
        </div>
        </div>
      </div>

      <EditTemplate
        applyChangesToBase={applyChangesToBaseTemplate}
        editorResetKey={templateEditorResetKey}
        formdata={templateEditorFormdata}
        isSaving={isSavingTemplate}
        isVisible={isVisible && isTemplateEditorVisible}
        saveDisabled={templateEditorSaveDisabled}
        templateName={selectedTemplate?.template_name || ""}
        onBack={handleBackFromTemplateEditor}
        onChange={handleTemplateEditorChange}
        onClose={onClose}
        onSave={handleSaveTemplateChanges}
        onToggleApplyChanges={setApplyChangesToBaseTemplate}
      />
    </>
  );
});
