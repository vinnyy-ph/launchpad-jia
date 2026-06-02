"use client";
import { handleCareerFitColor } from "@/lib/Utils";
import moment from "moment";
import EmailCandidateComponent from "./EmailCandidateComponent";
import DefaultInviteAutomationCard from "./DefaultInviteAutomationCard";
import CustomDropdown from "../CareerComponents/CustomDropdown";
import RichTextEditor from "../CareerComponents/RichTextEditor";
import { useState, useEffect, useMemo } from "react";
import EditTemplate from "../sections/modal-v2/EditTemplate";
import { useStageMapping } from "@/lib/utils/stageMapping";
import { Button, Toggle } from "../ui";
import { api } from "@/lib/utils/apiClient";
import { useParams } from "next/navigation";
import axios from "axios";
import { defaultEmailAutomations } from "@/lib/data/emailAutomation";

const matchFitOptions = [
  {
    name: "Strong Fit",
  },
  {
    name: "Good Fit",
  },
  {
    name: "Maybe Fit",
  },
  {
    name: "Not Fit",
  },
  {
    name: "N/A",
  },
];

export default function CandidateActionModal({
  candidate,
  onAction,
  action,
  hideRecruiterEvaluation = false,
  nextstage,
  substage,
  nextStageId,
  nextSubstageId,
  fromStage,
  fromSubstage,
  careerId,
  orgID,
}: {
  candidate: any;
  onAction: (action: string, data?: any) => void;
  action: string;
  hideRecruiterEvaluation?: boolean;
  nextstage?: string;
  substage?: string;
  nextStageId?: string;
  nextSubstageId?: string;
  fromStage?: string;
  fromSubstage?: string;
  careerId?: string;
  orgID?: string;
}) {
  const params = useParams();
  const resolvedCareerId = careerId || (params?.slug as string);
  const resolvedOrgID = orgID || candidate?.orgID;
  const [automations, setAutomations] = useState<any[]>([]);
  const [automationsToUse, setAutomationsToUse] = useState<
    Record<string, boolean>
  >({});
  const [templatesMap, setTemplatesMap] = useState<
    Record<
      string,
      {
        template_name: string;
        subject: string;
        message: string;
        type?: string;
        creatorEmail?: string;
        enable_schedule_send?: string;
        schedule_delay?: string;
        schedule_delay_unit?: string;
        enable_preferred_time?: string;
        preferred_time?: string;
      }
    >
  >({});
  const [expandedTemplateContent, setExpandedTemplateContent] = useState<
    Record<string, boolean>
  >({});
  const [isLoadingAutomations, setIsLoadingAutomations] = useState(false);
  const [matchFit, setMatchFit] = useState<string>("");
  const [evaluationNotes, setEvaluationNotes] = useState<string>("");
  const [isEvaluationExpanded, setIsEvaluationExpanded] = useState(false);

  // EditTemplate modal state
  const [isTemplateEditorVisible, setIsTemplateEditorVisible] = useState(false);
  const [templateEditorResetKey, setTemplateEditorResetKey] = useState(0);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [applyChangesToBaseTemplate, setApplyChangesToBaseTemplate] = useState(true);
  const [templateEditorFormdata, setTemplateEditorFormdata] = useState<Record<string, string>>({});
  const [templateEditorInitialState, setTemplateEditorInitialState] = useState<Record<string, string>>({});
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const currentUserEmail = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("userData") || localStorage.getItem("user");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.email || parsed?.user?.email || null;
    } catch { return null; }
  }, []);

  // Generate stage mapping using the candidate data
  const stageMapping = useStageMapping(candidate);

  // Track stage step change when component renders or candidate changes
  useEffect(() => {
    // Stage step change tracking logic can be added here if needed
  }, [stageMapping.stageStepChange, candidate]);

  const getAssesment = () => {
    let assesment = "N/A";

    if (
      candidate?.currentStep === "CV Screening" ||
      candidate?.stage === "Pending AI Interview"
    ) {
      assesment = candidate?.cvStatus;
    } else {
      assesment = candidate?.jobFit;
    }
    return assesment || "N/A";
  };

  useEffect(() => {
    if (action !== "endorse" && action !== "drop" && action !== "invite")
      return;

    let cancelled = false;

    const fetchAutomation = async () => {
      setIsLoadingAutomations(true);
      try {
        if (!resolvedCareerId || !resolvedOrgID) {
          setAutomations([]);
          setAutomationsToUse({});
          return;
        }

        const response = await api.get(
          `/api/emails/automation?orgID=${resolvedOrgID}&careerId=${resolvedCareerId}`,
        );
        if (cancelled) return;
        const apiAutomations = await response.data;
        
        // Merge API automations with defaults
        const mergedAutomations = [
          ...defaultEmailAutomations,
          ...apiAutomations
        ];
        
        const filteredAutomations = mergedAutomations.filter(
          (automation: any) =>
            automation.automation.active &&
            automation.automation.trigger_on_event.toLowerCase() ===
              action.toLowerCase() &&
            automation.stage_id === nextStageId &&
            automation.substage_id === nextSubstageId &&
            (!automation.automation.from_stage ||
              automation.automation.from_stage ===
                `${fromStage}: ${fromSubstage}`) &&
            (!automation.automation.to_stage ||
              automation.automation.to_stage === `${nextstage}: ${substage}`),
        );

        if (cancelled) return;
        // using the automation.automation.template_id fetch the email templates from api/emails/templates
        setAutomations(filteredAutomations);
        // Default: use all automations for this action
        const initial: Record<string, boolean> = {};
        // For invite action with no automations, initialize the default invite automation
        if (filteredAutomations.length === 0 && action === "invite") {
          initial["default-invite-automation"] = true;
        } else {
          filteredAutomations.forEach((a: any) => {
            const id = a.automation_id ?? a._id;
            if (id) initial[String(id)] = true;
          });
        }
        setAutomationsToUse(initial);

        // Fetch templates to show template names (using automation.automation.template_id)
        if (resolvedOrgID) {
          try {
            const authToken =
              typeof window !== "undefined"
                ? (localStorage.getItem("authToken") ??
                  (localStorage as any).authToken)
                : null;
            const templatesRes = await axios.get(
              `/api/emails/templates?orgID=${resolvedOrgID}`,
              { headers: { Authorization: authToken } },
            );
            if (cancelled) return;
            const templatesList = templatesRes?.data?.templates ?? [];
            const map: Record<string, (typeof templatesMap)[string]> = {};
            templatesList.forEach((t: any) => {
              if (t.template_id)
                map[t.template_id] = {
                  template_name: t.template_name ?? t.template_id,
                  subject: t.subject ?? "",
                  message: t.message ?? "",
                  type: t.type ?? "",
                  creatorEmail: t.creator?.email ?? t.creator_email ?? "",
                  enable_schedule_send: t.enable_schedule_send ? "true" : "false",
                  schedule_delay: String(t.schedule_delay ?? ""),
                  schedule_delay_unit: t.schedule_delay_unit ?? "Days",
                  enable_preferred_time: t.enable_preferred_time ? "true" : "false",
                  preferred_time: t.preferred_time ?? "",
                };
            });
            setTemplatesMap(map);
          } catch (_) {
            // ignore template fetch errors
          }
        }
      } catch (error) {
        if (!cancelled) console.error(error);
      } finally {
        if (!cancelled) setIsLoadingAutomations(false);
      }
    };

    fetchAutomation();
    return () => {
      cancelled = true;
    };
  }, [
    action,
    candidate?.orgID,
    fromStage,
    fromSubstage,
    nextStageId,
    nextSubstageId,
    nextstage,
    resolvedCareerId,
    resolvedOrgID,
    substage,
  ]);

  const actions = {
    endorse: {
      title: "Endorse Candidate",
      subtext: `Are you sure you want to endorse this candidate? <br /> <br /> You are about to endorse <span style="font-weight:700; color:#181D27;">${
        candidate?.name
      }</span>, who is assessed by Jia as a <span style="font-weight:700; color:${
        handleCareerFitColor(getAssesment())?.color
      };">${getAssesment()}</span> for the role.`,
      icon: "la-user-check",
      iconBGColor: "#D1FADF",
      color: "#039855",
      buttonText: "Endorse",
      buttonVariant: "primary",
    },
    drop: {
      title: "Drop Candidate",
      subtext: `Are you sure you want to drop this candidate? <br /> <br /> You are about to drop <span style="font-weight:700; color:#181D27;">${
        candidate?.name
      }</span>, who is assessed by Jia as a <span style="font-weight:700; color:${
        handleCareerFitColor(getAssesment())?.color
      };">${getAssesment()}</span> for the role.`,
      icon: "la-user-times",
      iconBGColor: "#FEE4E2",
      color: "#D92D20",
      buttonText: "Drop",
      buttonVariant: "tertiary",
    },
    reset: {
      title: "Reset Interview",
      subtext: "Are you sure you want to reset this interview?",
      icon: "la-exclamation-circle",
      color: "#D92D20",
      buttonText: "Reset",
      buttonVariant: "primary",
    },
    delete: {
      title: "Delete Interview",
      subtext: "Are you sure you want to delete this interview?",
      icon: "la-trash",
      iconBGColor: "#FEE4E2",
      color: "#D92D20",
      buttonText: "Delete",
      buttonVariant: "tertiary",
    },
    retake: {
      title: "Retake Interview Request",
      color: "#181D27",
      buttonText: "Approve",
      buttonVariant: "primary",
    },
    reconsider: {
      title: "Reconsider Candidate",
      subtext: `Are you sure you want to reconsider this candidate? <br /> <br /> You are about to reconsider <span style="font-weight:700; color:#181D27;">${
        candidate?.name
      }</span>, who is assessed by Jia as a <span style="font-weight:700; color:${
        handleCareerFitColor(getAssesment())?.color
      };">${getAssesment()}</span> for the role.`,
      icon: "la-user-check",
      iconBGColor: "#D1FADF",
      color: "#039855",
      buttonText: "Reconsider",
      buttonVariant: "primary",
    },
    invite: {
      title: "Invite to Job",
      subtext: `You are about to invite <span style="font-weight:700; color:#181D27;">${
        candidate?.name
      }</span> to apply for ${
        candidate?.selectedCareers?.length > 1
          ? `<span style="font-weight:700;">${candidate?.selectedCareers?.length} job positions</span>`
          : `the <span style="font-weight:700;">${candidate?.selectedCareers?.[0]?.jobTitle || "selected position"}</span> role`
      }.`,
      icon: "la-user-plus",
      iconBGColor: "#E0F2FE",
      color: "#0284C7",
      buttonText: "Invite",
      buttonBGColor: "#181D27",
      buttonVariant: "primary",
    },
  };

  const isRedesignedEndorseDrop =
    action === "endorse" || action === "drop";
  const canShowEvaluation =
    !hideRecruiterEvaluation && isRedesignedEndorseDrop;
  const showEvaluationFields = canShowEvaluation && isEvaluationExpanded;
  const currentStageLabel =
    [fromStage, fromSubstage].filter(Boolean).join(": ") ||
    [candidate?.stage, candidate?.currentStep].filter(Boolean).join(": ");
  const targetStageLabel =
    [nextstage, substage].filter(Boolean).join(": ") ||
    [candidate?.toStage, candidate?.toSubstage].filter(Boolean).join(": ");
  const candidateNameLabel = String(candidate?.name || "this candidate")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const safeCurrentStageLabel = String(currentStageLabel || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const safeTargetStageLabel = String(targetStageLabel || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const modalSupportingText =
    action === "endorse"
      ? `You are about to endorse <span style="font-weight:500; color:#181D27;">${candidateNameLabel}</span>${
          targetStageLabel
            ? ` to the <span style="font-weight:500; color:#181D27;">${safeTargetStageLabel}</span> stage.`
            : "."
        }`
      : action === "drop"
        ? `You are about to drop <span style="font-weight:500; color:#181D27;">${candidateNameLabel}</span>${
            currentStageLabel
              ? ` from the <span style="font-weight:500; color:#181D27;">${safeCurrentStageLabel}</span> stage.`
              : "."
          }`
        : actions[action]?.subtext;
  const defaultButtonVariant: "primary" | "tertiary" =
    action === "drop" || action === "delete" ? "tertiary" : "primary";

  const handleClose = () => {
    onAction("");
  };

  const handleConfirmAction = () => {
    const automationIdsToUse = Object.entries(automationsToUse)
      .filter(([, use]) => use)
      .map(([id]) => id);
    // Always pass an object with automationIdsToUse so parent receives it.
    const data: any = {
      automationIdsToUse: Array.isArray(automationIdsToUse)
        ? automationIdsToUse
        : [],
    };

    if (matchFit) {
      data.matchFit = matchFit;
      data.evaluationNotes = evaluationNotes;
    }

    onAction(action, data);

    const candidateEmailBtn = document.getElementById(
      "candidate-email-send-button",
    );
    if (candidateEmailBtn) {
      candidateEmailBtn.click();
    }
  };

  const getPreviewCompanyName = () => {
    if (candidate?.selectedCareers?.[0]?.companyName) {
      return candidate.selectedCareers[0].companyName;
    }

    if (candidate?.orgName || candidate?.activeOrg?.name || candidate?.organization?.name) {
      return (
        candidate?.orgName ||
        candidate?.activeOrg?.name ||
        candidate?.organization?.name
      );
    }

    if (typeof window !== "undefined" && localStorage.activeOrg) {
      try {
        const activeOrg = JSON.parse(localStorage.activeOrg);
        return activeOrg?.name || "Company";
      } catch (_) {
        return "Company";
      }
    }

    return "Company";
  };

  const replaceAutomationTemplateVariables = (templateContent: string) => {
    if (!templateContent) return "";

    const previewJobTitle =
      candidate?.selectedCareers?.[0]?.jobTitle ||
      candidate?.jobTitle ||
      "Selected role";
    const previewCompanyName = getPreviewCompanyName();
    const previewCandidateName = candidate?.name || "Candidate";
    const previewCandidateFirstName =
      previewCandidateName?.split(" ")[0] || previewCandidateName;
    const jobTitlesList =
      candidate?.selectedCareers?.length > 0
        ? `<ul style="margin: 12px 0; padding-left: 20px;">${candidate.selectedCareers
            .map((career: any) => `<li style="margin: 4px 0;">${career.jobTitle}</li>`)
            .join("")}</ul>`
        : previewJobTitle;

    const variableMap: Record<string, string> = {
      "Job Title": previewJobTitle,
      "Company Name": previewCompanyName,
      "Employer Company Name": previewCompanyName,
      "Candidate First Name": previewCandidateFirstName,
      "Candidate Full Name": previewCandidateName,
      "Candidate Name": previewCandidateName,
      "JIA Job Portal Link": "https://hellojia.ai",
      "Job Titles List": jobTitlesList,
      "From Stage": currentStageLabel || "",
      "To Stage": targetStageLabel || "",
      "Current Stage": currentStageLabel || "",
      "Current Step": candidate?.currentStep || "",
    };

    const normalizeTokenName = (tokenName: string) => {
      const cleanTokenName = tokenName.replace(/[\[\]]/g, "").trim();
      const prefixMatch = cleanTokenName.match(/^[A-Za-z]+-(.+)$/);
      if (prefixMatch) {
        return prefixMatch[1].trim();
      }
      return cleanTokenName;
    };

    const getTokenValue = (tokenName: string) => {
      const normalizedName = normalizeTokenName(tokenName);
      return (
        variableMap[tokenName.trim()] ||
        variableMap[normalizedName] ||
        null
      );
    };

    let parsed = templateContent;

    parsed = parsed.replace(
      /<span[^>]*data-token="(?:\[\[)?([^\]"]+)(?:\]\])?"[^>]*>(.*?)<\/span>/gis,
      (match, variableName, displayText) =>
        getTokenValue(String(variableName)) ?? displayText ?? match,
    );

    parsed = parsed
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#91;/g, "[")
      .replace(/&#93;/g, "]")
      .replace(/&nbsp;/g, " ");

    const replacementEntries = new Map<string, string>();

    Object.entries(variableMap).forEach(([varName, value]) => {
      replacementEntries.set(varName, value);
      replacementEntries.set(normalizeTokenName(varName), value);
    });

    replacementEntries.forEach((value, varName) => {
      parsed = parsed
        .replace(
          new RegExp(
            `\\[\\[${varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\]`,
            "gi",
          ),
          value,
        )
        .replace(
          new RegExp(
            `\\[${varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`,
            "gi",
          ),
          value,
        );
    });

    const highlightValues = [
      previewCandidateName,
      previewCandidateFirstName,
      previewJobTitle,
      previewCompanyName,
      currentStageLabel || "",
      targetStageLabel || "",
    ]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    highlightValues.forEach((value) => {
      const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      parsed = parsed.replace(
        new RegExp(escapedValue, "g"),
        `<span style="color:#175CD3; font-weight:500;">${value}</span>`,
      );
    });

    return parsed;
  };

  useEffect(() => {
    setIsEvaluationExpanded(false);
  }, [action, candidate?._id]);

  const canEditTemplate = (templateId: string) => {
    const t = templatesMap[templateId];
    if (!t) return true;
    return t.type?.toLowerCase() === "user" && t.creatorEmail === currentUserEmail;
  };

  const getEditTooltip = (templateId: string): string => {
    const t = templatesMap[templateId];
    if (!t) return "";
    const type = t.type?.toLowerCase();
    if (type === "system") return "System templates cannot be edited.";
    if (type === "global") return "Global templates cannot be edited.";
    if (type === "user" && t.creatorEmail !== currentUserEmail)
      return "Only your own user templates can be edited.";
    return "";
  };

  const handleOpenTemplateEditor = (templateId: string) => {
    const t = templatesMap[templateId];
    if (t && !canEditTemplate(templateId)) return;
    const formdata: Record<string, string> = {
      template_name: t?.template_name ?? "",
      subject: t?.subject ?? "",
      message: t?.message ?? "",
      // always start OFF so the user opts-in deliberately
      enable_schedule_send: "false",
      schedule_delay: t?.schedule_delay ?? "",
      schedule_delay_unit: t?.schedule_delay_unit ?? "Days",
      enable_preferred_time: "false",
      preferred_time: t?.preferred_time ?? "",
    };
    setTemplateEditorFormdata(formdata);
    setTemplateEditorInitialState(formdata);
    setEditingTemplateId(templateId);
    setApplyChangesToBaseTemplate(false);
    setTemplateEditorResetKey((prev) => prev + 1);
    setIsTemplateEditorVisible(true);
  };

  const handleTemplateEditorChange = ({ id, value }: { id: string; value: string }) => {
    setTemplateEditorFormdata((prev) => ({ ...prev, [id]: value }));
  };

  const handleSaveTemplateChanges = async () => {
    if (isSavingTemplate) return;

    const activeOrgRaw = localStorage.getItem("activeOrg");
    if (!activeOrgRaw) {
      alert("Failed to load organization information. Please check your session.");
      return;
    }
    let orgID: string;
    try {
      orgID = JSON.parse(activeOrgRaw)._id;
      if (!orgID) throw new Error();
    } catch {
      alert("Failed to load organization information. Please check your session.");
      return;
    }

    const payload = {
      orgID,
      template_name: templateEditorFormdata.template_name?.trim(),
      subject: templateEditorFormdata.subject?.trim(),
      message: templateEditorFormdata.message?.trim(),
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

    try {
      setIsSavingTemplate(true);

      if (applyChangesToBaseTemplate && editingTemplateId) {
        // Toggle ON: patch the existing template in place — automation references unchanged
        const response = await api.patch(`/api/emails/templates`, {
          ...payload,
          templateID: editingTemplateId,
        });
        setTemplatesMap((prev) => ({
          ...prev,
          [editingTemplateId]: {
            ...prev[editingTemplateId],
            ...payload,
            dateUpdated: response.data?.data?.dateUpdated || new Date().toString(),
          },
        }));
      } else {
        // Toggle OFF: create a new template record, then update every automation
        // that referenced the old template to point to the new one
        const response = await api.post(`/api/emails/templates`, {
          ...payload,
          type: "User",
          is_copy: true,
        });
        const newId: string = response.data?.data?.template_id ?? response.data?.insertedId;
        if (newId) {
          setTemplatesMap((prev) => ({
            ...prev,
            [newId]: {
              ...payload,
              template_id: newId,
              type: "User",
              creatorEmail: currentUserEmail ?? "",
              dateUpdated: response.data?.data?.date_updated || new Date().toString(),
            },
          }));

          // Update each automation that used the old template_id to use the new one
          const affectedAutomations = automations.filter((a: any) => {
            const tid = a.automation?.template_id ?? a.template_id;
            return tid === editingTemplateId;
          });

          await Promise.all(
            affectedAutomations.map(async (a: any) => {
              const automationId = String(a.automation_id ?? a._id ?? "");
              if (!automationId) return;
              const automationObj = a.automation ?? a;
              await api.put(`/api/emails/automation`, {
                automation_id: automationId,
                orgID,
                automation: {
                  ...automationObj,
                  template_id: newId,
                },
              });
            }),
          );

          // Reflect the new template_id in local automations state
          setAutomations((prev: any[]) =>
            prev.map((a: any) => {
              const tid = a.automation?.template_id ?? a.template_id;
              if (tid !== editingTemplateId) return a;
              if (a.automation) {
                return { ...a, automation: { ...a.automation, template_id: newId } };
              }
              return { ...a, template_id: newId };
            }),
          );
        }
      }

      setIsTemplateEditorVisible(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const templateEditorSaveDisabled = useMemo(() => {
    const requiredKeys = ["template_name", "subject", "message"];
    const hasRequiredValues = requiredKeys.every((key) =>
      Boolean(templateEditorFormdata[key]?.trim()),
    );
    if (!hasRequiredValues) return true;
    if (!applyChangesToBaseTemplate) return false;
    return JSON.stringify(templateEditorFormdata) === JSON.stringify(templateEditorInitialState);
  }, [templateEditorFormdata, templateEditorInitialState, applyChangesToBaseTemplate]);

  return (
    <>
    <div className="modal-background fade-in-bottom">
      <div className="modal-container">
        <div
          className="modal-content"
          style={{
            overflowY: isRedesignedEndorseDrop ? undefined : "auto",
            maxHeight: "calc(100vh - 40px)",
            maxWidth:
              isRedesignedEndorseDrop
                ? "640px"
                : !hideRecruiterEvaluation &&
                    (candidate?.forEvaluation || action === "drop")
                ? "1200px"
                : "640px",
            width: "100%",
            background: "#fff",
            border: `1.5px solid #E9EAEB`,
            borderRadius: isRedesignedEndorseDrop ? 16 : 14,
            boxShadow: "0 8px 32px rgba(30,32,60,0.18)",
            padding: isRedesignedEndorseDrop ? 0 : "32px",
            display: "flex",
            flexDirection: "column",
            overflow: isRedesignedEndorseDrop ? "hidden" : undefined,
          }}
        >
          {action === "retake" ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <h3 className="modal-title">{actions[action]?.title}</h3>
                {/* Close Button */}
                <button
                  onClick={() => onAction("")}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <i
                    className="la la-times"
                    style={{ fontSize: 24, color: "#717680" }}
                  ></i>
                </button>
              </div>
              <span
                style={{ fontSize: 14, color: "#717680", maxWidth: "540px" }}
              >
                {" "}
                <strong>Reason:</strong>{" "}
                {candidate?.retakeRequest?.reason ||
                  candidate?.retakeRequest ||
                  "No reason provided"}
              </span>
              <span
                style={{ fontSize: 14, color: "#717680", maxWidth: "540px" }}
              >
                {" "}
                <strong>Request submitted on:</strong>{" "}
                {moment(candidate?.retakeRequest?.createdAt).format(
                  "MMM D, YYYY | hh:mm:ss A",
                )}
              </span>

              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 16,
                  width: "100%",
                }}
              >
                <Button
                  variant="tertiary-outline"
                  label="Reject"
                  style={{
                    minWidth: "163px",
                  }}
                  onClick={() => {
                    // e.preventDefault();
                    onAction("reject");
                  }}
                ></Button>
                <Button
                  variant="primary"
                  style={{ minWidth: "163px" }}
                  onClick={() => {
                    // e.preventDefault();
                    onAction("approve");
                  }}
                  label="Approve"
                  icon="/circle-check.svg"
                ></Button>
              </div>
            </div>
          ) : isRedesignedEndorseDrop ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "24px 24px 0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      minWidth: 48,
                      borderRadius: 9999,
                      backgroundColor: actions[action]?.iconBGColor || "#ECFDF3",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <i
                      className={`la ${actions[action]?.icon}`}
                      style={{
                        fontSize: 24,
                        color: actions[action]?.color,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      minWidth: 0,
                    }}
                  >
                    <h3
                      className="modal-title"
                      style={{
                        margin: 0,
                        fontSize: 18,
                        fontWeight: 600,
                        color: "#181D27",
                        textAlign: "left",
                      }}
                    >
                      {actions[action]?.title}
                    </h3>
                    <span
                      style={{
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: "#535862",
                        textAlign: "left",
                      }}
                      dangerouslySetInnerHTML={{
                        __html: modalSupportingText,
                      }}
                    >
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    color: "#717680",
                    lineHeight: 1,
                  }}
                >
                  <i className="la la-times" style={{ fontSize: 24 }} />
                </button>
              </div>

              <div
                style={{
                  borderTop: "1px solid #E9EAEB",
                  marginTop: 24,
                }}
              />

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: showEvaluationFields ? 40 : 16,
                  padding: "20px 24px 0",
                  overflowY: "auto",
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {canShowEvaluation && (
                  <div
                    onClick={() => setIsEvaluationExpanded((prev) => !prev)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setIsEvaluationExpanded((prev) => !prev);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 16,
                      background: "#F9F9FB",
                      border: "1px dashed #D5D7DA",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        minWidth: 40,
                        borderRadius: 8,
                        background: "#FFFFFF",
                        border: "1px solid #D5D7DA",
                        boxShadow:
                          "0px 1px 2px 0px rgba(10, 13, 18, 0.05), inset 0px -2px 0px 0px rgba(10, 13, 18, 0.05), inset 0px 0px 0px 1px rgba(10, 13, 18, 0.18)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <i
                        className="la la-clipboard-check"
                        style={{ fontSize: 20, color: "#414651" }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 500,
                          color: "#181D27",
                          textAlign: "left",
                        }}
                      >
                        Recruiter Evaluation
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          lineHeight: 1.5,
                          color: "#535862",
                          textAlign: "left",
                        }}
                      >
                        Add an evaluation for this candidate
                      </span>
                    </div>
                    <div
                      style={{
                        marginLeft: "auto",
                        width: 28,
                        height: 28,
                        minWidth: 28,
                        borderRadius: 8,
                        border: "1px solid #D5D7DA",
                        background: "#FFFFFF",
                        boxShadow:
                          "0px 1px 2px 0px rgba(10, 13, 18, 0.05), inset 0px -2px 0px 0px rgba(10, 13, 18, 0.05), inset 0px 0px 0px 1px rgba(10, 13, 18, 0.18)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#414651",
                      }}
                    >
                      <i
                        className={
                          isEvaluationExpanded ? "la la-minus" : "la la-plus"
                        }
                        style={{ fontSize: 16 }}
                      />
                    </div>
                  </div>
                )}

                {showEvaluationFields && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: "#414651",
                            textAlign: "left",
                          }}
                        >
                          Match Fit
                        </span>
                        <CustomDropdown
                          screeningSetting={matchFit}
                          settingList={matchFitOptions}
                          placeholder="Select match fit"
                          onSelectSetting={setMatchFit}
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: "#414651",
                            textAlign: "left",
                          }}
                        >
                          Evaluation Notes
                        </span>
                        <div
                          className="candidate-action-modal-evaluation-editor"
                          style={{ width: "100%" }}
                        >
                          <RichTextEditor
                            setText={setEvaluationNotes}
                            text={evaluationNotes}
                            error=""
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    paddingBottom: 24,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 500,
                        color: "#181D27",
                      }}
                    >
                      Email Automations
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: "#535862",
                      }}
                    >
                      You can enable or disable active automations to run for
                      this action
                    </span>
                  </div>

                  <style
                    dangerouslySetInnerHTML={{
                      __html: `
                        .candidate-action-modal-template-content [data-token] { color: #2563EB !important; font-style: italic; }
                        .candidate-action-modal-evaluation-editor [contenteditable="true"] { height: 180px !important; min-height: 180px !important; }
                        .candidate-action-modal-edit-tooltip {
                          position: relative;
                        }
                        .candidate-action-modal-edit-tooltip-text {
                          position: absolute;
                          bottom: calc(100% + 8px);
                          right: 0;
                          background: #181D27;
                          color: #FFFFFF;
                          padding: 8px 10px;
                          border-radius: 8px;
                          font-size: 12px;
                          line-height: 1.4;
                          white-space: normal;
                          width: 220px;
                          opacity: 0;
                          visibility: hidden;
                          pointer-events: none;
                          transition: opacity 0.15s ease;
                          box-shadow: 0px 8px 16px rgba(10, 13, 18, 0.12);
                          z-index: 2;
                        }
                        .candidate-action-modal-edit-tooltip:hover .candidate-action-modal-edit-tooltip-text {
                          opacity: 1;
                          visibility: visible;
                        }
                      `,
                    }}
                  />

                  {isLoadingAutomations ? (
                    <div
                      style={{
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                        padding: 40,
                        color: "#535862",
                        fontSize: 14,
                        border: "1px solid #E9EAEB",
                        borderRadius: 12,
                      }}
                    >
                      <i
                        className="la la-spinner la-spin"
                        style={{ fontSize: 28, color: actions[action]?.color }}
                      />
                      <span>Loading automations...</span>
                    </div>
                  ) : automations.length === 0 ? (
                    <div
                      style={{
                        padding: "32px 24px",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "100%",
                        background: "#FDFDFD",
                        borderRadius: 12,
                        border: "1px solid #E9EAEB",
                        boxShadow: "0px 1px 2px 0px rgba(10, 13, 18, 0.05)",
                        color: "#535862",
                        fontSize: 14,
                        lineHeight: 1.6,
                      }}
                    >
                      <i
                        className="la la-inbox"
                        style={{
                          fontSize: 28,
                          color: "#A4A7AE",
                          marginBottom: 12,
                        }}
                      />
                      <span
                        style={{
                          fontWeight: 500,
                          color: "#181D27",
                        }}
                      >
                        No automation configured
                      </span>
                      <span>for this action and stage.</span>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                        width: "100%",
                      }}
                    >
                      {automations.map((automation: any) => {
                        const id = String(
                          automation.automation_id ?? automation._id ?? "",
                        );
                        const useForAction = automationsToUse[id] ?? true;
                        const name =
                          automation.automation?.automation_name ??
                          automation.automation_name ??
                          "Automation";
                        const templateId =
                          automation.automation?.template_id ??
                          automation.template_id;
                        const templateInfo = templateId
                          ? templatesMap[templateId]
                          : null;
                        const templateName = templateInfo
                          ? templateInfo.template_name
                          : (templateId ?? "Template unavailable");
                        const templateSubject = templateInfo?.subject ?? "";
                        const templateMessage = templateInfo?.message ?? "";
                        const previewAvailable =
                          Boolean(templateSubject) || Boolean(templateMessage);
                        const jobTitle =
                          candidate?.selectedCareers?.[0]?.jobTitle ||
                          candidate?.jobTitle ||
                          "Selected role";
                        const companyName = getPreviewCompanyName();
                        const candidateName =
                          candidate?.name || "Candidate";
                        const resolvedTemplateSubject =
                          replaceAutomationTemplateVariables(templateSubject);
                        const resolvedTemplateMessage =
                          replaceAutomationTemplateVariables(templateMessage);
                        const previewHeaderHtml = [
                          {
                            value: jobTitle,
                            color: "#175CD3",
                            weight: 500,
                          },
                          {
                            value: "at",
                            color: "#414651",
                            weight: 400,
                          },
                          {
                            value: companyName,
                            color: "#175CD3",
                            weight: 500,
                          },
                          {
                            value: "-",
                            color: "#414651",
                            weight: 400,
                          },
                          {
                            value: candidateName,
                            color: "#175CD3",
                            weight: 500,
                          },
                        ]
                          .map(
                            ({ value, color, weight }) =>
                              `<span style="color:${color}; font-weight:${weight};">${String(
                                value,
                              )
                                .replace(/&/g, "&amp;")
                                .replace(/</g, "&lt;")
                                .replace(/>/g, "&gt;")}</span>`,
                          )
                          .join(" ");
                        const previewBodyHtml = [
                          resolvedTemplateSubject,
                          resolvedTemplateMessage,
                        ]
                          .filter(Boolean)
                          .map((content, index) => {
                            if (!content) return "";
                            if (/<[a-z][\s\S]*>/i.test(content)) {
                              return index === 0
                                ? `<div style="margin:0 0 12px 0; font-weight:500; color:#181D27;">${content}</div>`
                                : `<div style="margin:0; color:#181D27;">${content}</div>`;
                            }

                            const safeContent = content
                              .replace(/&/g, "&amp;")
                              .replace(/</g, "&lt;")
                              .replace(/>/g, "&gt;");

                            return safeContent
                              .split("\n")
                              .map((line: string, lineIndex: number) =>
                                line
                                  ? `<p style="margin:0 0 ${lineIndex === safeContent.split("\n").length - 1 ? 0 : 8}px 0; white-space: pre-wrap; ${index === 0 ? "font-weight:500;" : ""}">${line}</p>`
                                  : "<br />",
                              )
                              .join("");
                          })
                          .join(
                            templateSubject && templateMessage
                              ? '<div style="height:12px;"></div>'
                              : "",
                          );

                        return (
                          <div
                            key={id}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 0,
                              width: "100%",
                              background: "#FDFDFD",
                              border: `1px solid ${
                                useForAction ? "#E9EAEB" : "#F2F4F7"
                              }`,
                              borderRadius: 12,
                              boxShadow:
                                "0px 1px 2px 0px rgba(10, 13, 18, 0.05)",
                              opacity: useForAction ? 1 : 0.72,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 16,
                                flexWrap: "wrap",
                                padding: "12px 16px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  minWidth: 0,
                                  flex: 1,
                                }}
                              >
                                <div
                                  style={{
                                    width: 24,
                                    height: 24,
                                    minWidth: 24,
                                    borderRadius: 9999,
                                    background: "#DCFAE6",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <i
                                    className="la la-bolt"
                                    style={{
                                      fontSize: 13,
                                      color: "#12B76A",
                                    }}
                                  />
                                </div>
                                <span
                                  style={{
                                    fontSize: 16,
                                    fontWeight: 500,
                                    color: "#414651",
                                    textAlign: "left",
                                  }}
                                >
                                  {name}
                                </span>
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <Toggle
                                  checked={useForAction}
                                  onChange={(checked) =>
                                    setAutomationsToUse((prev) => ({
                                      ...prev,
                                      [id]: checked,
                                    }))
                                  }
                                />
                                <span
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 500,
                                    color: "#414651",
                                  }}
                                >
                                  Use for this action
                                </span>
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 12,
                                padding: "16px 24px 16px 16px",
                                borderRadius: 12,
                                border: "1px solid #E9EAEB",
                                background: "#FFFFFF",
                                  margin: 0,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 16,
                                  flexWrap: "wrap",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    minWidth: 0,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 14,
                                      fontWeight: 500,
                                      color: "#414651",
                                    }}
                                  >
                                    {`Template: ${templateName}`}
                                  </span>
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      padding: "2px 6px",
                                      borderRadius: 6,
                                      background: "#FAFAFA",
                                      border: "1px solid #E9EAEB",
                                      fontSize: 12,
                                      fontWeight: 500,
                                      color: "#414651",
                                    }}
                                  >
                                    System
                                  </span>
                                </div>

                                {(() => {
                                  const canEdit = templateId ? canEditTemplate(templateId) : true;
                                  const tooltipText = templateId ? getEditTooltip(templateId) : "";
                                  return (
                                    <div
                                      className="candidate-action-modal-edit-tooltip"
                                      aria-label={tooltipText || "Edit template"}
                                      style={{ display: "inline-flex" }}
                                    >
                                      <button
                                        type="button"
                                        aria-disabled={!canEdit}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          width: 28,
                                          height: 28,
                                          background: "#FFFFFF",
                                          border: "1px solid #D5D7DA",
                                          borderRadius: 6,
                                          color: "#414651",
                                          cursor: canEdit ? "pointer" : "not-allowed",
                                          opacity: canEdit ? 1 : 0.5,
                                          boxShadow:
                                            "0px 0.8333333134651184px 1.6666666269302368px 0px rgba(10, 13, 18, 0.05), inset 0px -1.6666666269302368px 0px 0px rgba(10, 13, 18, 0.05), inset 0px 0px 0px 0.8333333134651184px rgba(10, 13, 18, 0.18)",
                                          padding: 0,
                                        }}
                                        onClick={() => {
                                          if (canEdit && templateId) handleOpenTemplateEditor(templateId);
                                        }}
                                      >
                                        <i className="la la-pen" style={{ fontSize: 14 }} />
                                      </button>
                                      {tooltipText && (
                                        <span className="candidate-action-modal-edit-tooltip-text">
                                          {tooltipText}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>

                              {previewAvailable && (
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 12,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 12,
                                      alignItems: "stretch",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: 14,
                                        lineHeight: 1.6,
                                        color: "#181D27",
                                        textAlign: "left",
                                        wordBreak: "break-word",
                                      }}
                                      dangerouslySetInnerHTML={{
                                        __html: previewHeaderHtml,
                                      }}
                                    />
                                    <div
                                      style={{
                                        borderTop: "1px solid #E9EAEB",
                                      }}
                                    />
                                    <div
                                      className="candidate-action-modal-template-content"
                                      style={{
                                        fontSize: 14,
                                        lineHeight: 1.6,
                                        color: "#181D27",
                                        textAlign: "left",
                                        wordBreak: "break-word",
                                        maxHeight: 220,
                                        overflowY: "auto",
                                      }}
                                      dangerouslySetInnerHTML={{
                                        __html: previewBodyHtml,
                                      }}
                                    />
                                  </div>
                                </div>
                              )}

                              {!previewAvailable && (
                                <span
                                  style={{
                                    fontSize: 14,
                                    lineHeight: 1.5,
                                    color: "#535862",
                                    textAlign: "left",
                                  }}
                                >
                                  No template preview available for this
                                  automation.
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid #E9EAEB",
                  padding: "24px",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <Button
                  onClick={handleClose}
                  variant="secondary"
                  label="Cancel"
                ></Button>
                <Button
                  onClick={handleConfirmAction}
                  variant={
                    (
                      action === "drop"
                        ? "tertiary-filled-destructive"
                        : defaultButtonVariant
                    ) as "primary" | "tertiary" | "tertiary-filled-destructive"
                  }
                  label={actions[action]?.buttonText}
                ></Button>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 20,
                textAlign: "center",
                flex: 1,
                minHeight: 0,
                paddingTop: "16px",
                paddingBottom: "16px",
              }}
            >
              {/* Header with Icon */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 16,
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    backgroundColor: actions[action]?.iconBGColor || "#dcfce7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i
                    className={`la ${actions[action]?.icon}`}
                    style={{ fontSize: 32, color: actions[action]?.color }}
                  ></i>
                </div>
                <h3
                  className="modal-title"
                  style={{
                    fontSize: "24px",
                    fontWeight: "600",
                    color: "#333",
                    margin: 0,
                  }}
                >
                  {actions[action]?.title}
                </h3>
                <span
                  style={{
                    fontSize: 16,
                    color: "#666",
                    maxWidth: "400px",
                    lineHeight: "1.5",
                  }}
                  dangerouslySetInnerHTML={{ __html: actions[action]?.subtext }}
                ></span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "stretch",
                  gap: 20,
                  width: "100%",
                  borderTop: "1px solid #E9EAEB",
                  paddingTop: "16px",
                  height: 380,
                  minHeight: 380,
                  maxHeight: "50vh",
                  overflow: "hidden",
                }}
              >
                {!hideRecruiterEvaluation &&
                  (action === "drop" ||
                    (action === "endorse" && candidate?.forEvaluation)) && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        justifyContent: "flex-start",
                        gap: 16,
                        width: "calc(50% - 10px)",
                        minWidth: 0,
                        height: "100%",
                        overflowY: "auto",
                        overflowX: "hidden",
                      }}
                    >
                      <h3
                        style={{
                          fontSize: 18,
                          color: "#181D27",
                          fontWeight: 700,
                        }}
                      >
                        Recruiter Evaluation
                      </h3>
                      <span
                        style={{
                          fontSize: 14,
                          color: "#414651",
                          fontWeight: 500,
                        }}
                      >
                        Match Fit
                      </span>
                      <CustomDropdown
                        screeningSetting={matchFit}
                        settingList={matchFitOptions}
                        placeholder="Select Match Fit"
                        onSelectSetting={setMatchFit}
                      />
                      <span
                        style={{
                          fontSize: 14,
                          color: "#414651",
                          fontWeight: 500,
                        }}
                      >
                        Evaluation Notes
                      </span>
                      <div style={{ width: "100%" }}>
                        <RichTextEditor
                          setText={setEvaluationNotes}
                          text={evaluationNotes}
                          error=""
                        />
                      </div>
                    </div>
                  )}
                {/* Email Component - Only render for endorse, drop, or invite actions */}
                {(action === "endorse" ||
                  action === "drop" ||
                  action === "invite") && (
                  <div
                    style={{
                      width:
                        !hideRecruiterEvaluation &&
                        (action === "drop" ||
                          (action === "endorse" && candidate?.forEvaluation))
                          ? "calc(50% - 10px)"
                          : "100%",
                      minWidth: 0,
                      flex: 1,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      textAlign: "left",
                      overflowY: "auto",
                      overflowX: "hidden",
                      paddingRight: 4,
                    }}
                  >
                    <style
                      dangerouslySetInnerHTML={{
                        __html: `.candidate-action-modal-template-content [data-token] { color: #2563EB !important; font-style: italic; }`,
                      }}
                    />
                    {/* ADD AUTOMATION CARDS HERE */}
                    {isLoadingAutomations ? (
                      <div
                        style={{
                          width: "100%",
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 12,
                          padding: 40,
                          color: "#6B7280",
                          fontSize: 14,
                        }}
                      >
                        <i
                          className="la la-spinner la-spin"
                          style={{ fontSize: 28, color: "#059669" }}
                        />
                        <span>Loading automations...</span>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 20,
                          width: "100%",
                          padding: "20px 0",
                          alignItems: "flex-start",
                          textAlign: "left",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            paddingBottom: 4,
                            width: "100%",
                            justifyContent: "flex-start",
                            textAlign: "left",
                          }}
                        >
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 12,
                              background:
                                "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <i
                              className="la la-bolt"
                              style={{ fontSize: 20, color: "#059669" }}
                            />
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 17,
                                fontWeight: 600,
                                color: "#111827",
                                letterSpacing: "-0.02em",
                              }}
                            >
                              Automations
                            </span>
                            <span
                              style={{
                                fontSize: 13,
                                color: "#6B7280",
                                fontWeight: 400,
                                lineHeight: 1.3,
                              }}
                            >
                              Choose which to run for this action
                            </span>
                          </div>
                        </div>
                        {automations.length === 0 ? (
                          action === "invite" ? (
                            // Default invite card
                            <DefaultInviteAutomationCard
                              candidate={candidate}
                              actions={actions}
                              automationsToUse={automationsToUse}
                              setAutomationsToUse={setAutomationsToUse}
                            />
                          ) : (
                            // No automation configured for other actions
                            <div
                              style={{
                                padding: "40px 24px",
                                textAlign: "center",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "100%",
                                background:
                                  "linear-gradient(180deg, #F9FAFB 0%, #F3F4F6 100%)",
                                borderRadius: 20,
                                border: "1.5px dashed #D1D5DB",
                                color: "#6B7280",
                                fontSize: 14,
                                lineHeight: 1.6,
                              }}
                            >
                              <i
                                className="la la-inbox"
                                style={{
                                  fontSize: 32,
                                  color: "#9CA3AF",
                                  marginBottom: 12,
                                  display: "block",
                                }}
                              />
                              <span style={{ fontWeight: 500, color: "#4B5563" }}>
                                No automation configured
                              </span>
                              <br />
                              <span style={{ fontSize: 13 }}>
                                for this action and stage.
                              </span>
                            </div>
                          )
                        ) : (
                          automations.map((automation: any) => {
                            const id = String(
                              automation.automation_id ?? automation._id ?? "",
                            );
                            const isActive =
                              automation.automation?.active ?? false;
                            const useForAction = automationsToUse[id] ?? true;
                            const name =
                              automation.automation?.automation_name ??
                              automation.automation_name ??
                              "Automation";
                            const trigger =
                              automation.automation?.trigger_on_event ??
                              automation.trigger_on_event ??
                              "—";
                            const templateId =
                              automation.automation?.template_id ??
                              automation.template_id;
                            const templateInfo = templateId
                              ? templatesMap[templateId]
                              : null;
                            const templateName = templateInfo
                              ? templateInfo.template_name
                              : (templateId ?? "—");
                            const templateSubject = templateInfo?.subject ?? "";
                            const templateMessage = templateInfo?.message ?? "";
                            return (
                              <div
                                key={id}
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 0,
                                  width: "100%",
                                  padding: "20px 18px 20px 24px",
                                  background: useForAction
                                    ? "linear-gradient(145deg, #FFFFFF 0%, #F8FDFA 100%)"
                                    : "#F6F7F9",
                                  border: `1px solid ${useForAction ? "#DDE4EC" : "#E8ECF0"}`,
                                  borderRadius: 14,
                                  boxShadow: useForAction
                                    ? "0 3px 14px rgba(5, 150, 105, 0.07), 0 1px 4px rgba(0,0,0,0.05)"
                                    : "0 1px 4px rgba(0,0,0,0.04)",
                                  position: "relative",
                                  overflow: "hidden",
                                  transition:
                                    "box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease",
                                }}
                              >
                                <div
                                  style={{
                                    position: "absolute",
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: 4,
                                    background: useForAction
                                      ? "linear-gradient(180deg, #10B981 0%, #059669 50%, #047857 100%)"
                                      : "linear-gradient(180deg, #E5E7EB 0%, #D1D5DB 100%)",
                                    borderRadius: "14px 0 0 14px",
                                  }}
                                />
                                {/* Row 1: Name + Active pill + Use for this action + Toggle */}
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 16,
                                    flexWrap: "wrap",
                                    marginBottom: 14,
                                    paddingLeft: 4,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 10,
                                      flexWrap: "wrap",
                                      flex: 1,
                                      minWidth: 0,
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: 15,
                                        fontWeight: 600,
                                        color: "#111827",
                                        letterSpacing: "-0.02em",
                                      }}
                                    >
                                      {name}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 600,
                                        padding: "3px 8px",
                                        borderRadius: 6,
                                        background: isActive
                                          ? "linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)"
                                          : "#EEF1F5",
                                        color: isActive
                                          ? "#047857"
                                          : "#6B7280",
                                      }}
                                    >
                                      {isActive ? "Active" : "Inactive"}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 10,
                                      flexShrink: 0,
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: "#6B7280",
                                        letterSpacing: "0.02em",
                                        textTransform: "uppercase",
                                      }}
                                    >
                                      Use for this action
                                    </span>
                                    <Toggle
                                      checked={useForAction}
                                      onChange={(checked) =>
                                        setAutomationsToUse((prev) => ({
                                          ...prev,
                                          [id]: checked,
                                        }))
                                      }
                                    />
                                  </div>
                                </div>
                                {/* Trigger, Template, View subject & message (full width) */}
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                    width: "100%",
                                    alignItems: "flex-start",
                                    textAlign: "left",
                                    paddingLeft: 4,
                                  }}
                                >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        fontSize: 13,
                                        color: "#6B7280",
                                        lineHeight: 1.45,
                                        justifyContent: "flex-start",
                                        width: "100%",
                                        textAlign: "left",
                                      }}
                                    >
                                      <i
                                        className="la la-play-circle"
                                        style={{
                                          fontSize: 14,
                                          color: "#9CA3AF",
                                          flexShrink: 0,
                                        }}
                                      />
                                      <span style={{ textAlign: "left" }}>
                                        <span
                                          style={{
                                            fontWeight: 500,
                                            color: "#4B5563",
                                          }}
                                        >
                                          Trigger:
                                        </span>{" "}
                                        {trigger}
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        fontSize: 13,
                                        color: "#6B7280",
                                        lineHeight: 1.45,
                                        justifyContent: "flex-start",
                                        width: "100%",
                                        textAlign: "left",
                                      }}
                                    >
                                      <i
                                        className="la la-file-alt"
                                        style={{
                                          fontSize: 14,
                                          color: "#9CA3AF",
                                          flexShrink: 0,
                                        }}
                                      />
                                      <span style={{ textAlign: "left" }}>
                                        <span
                                          style={{
                                            fontWeight: 500,
                                            color: "#4B5563",
                                          }}
                                        >
                                          Template:
                                        </span>{" "}
                                        {templateName}
                                      </span>
                                    </div>
                                    {(templateSubject || templateMessage) && (
                                      <div
                                        style={{
                                          marginTop: 6,
                                          width: "100%",
                                          maxWidth: "100%",
                                          border: "1px solid #E5E7EB",
                                          borderRadius: 12,
                                          overflow: "hidden",
                                          background: "#FAFBFC",
                                          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                                        }}
                                      >
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedTemplateContent(
                                              (prev) => ({
                                                ...prev,
                                                [id]: !prev[id],
                                              }),
                                            )
                                          }
                                          style={{
                                            width: "100%",
                                            maxWidth: "100%",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 8,
                                            padding: "12px 14px",
                                            background: "transparent",
                                            border: "none",
                                            cursor: "pointer",
                                            textAlign: "left",
                                            fontSize: 14,
                                            fontWeight: 500,
                                            color: "#4B5563",
                                            boxSizing: "border-box",
                                          }}
                                        >
                                          <span
                                            style={{
                                              flex: 1,
                                              minWidth: 0,
                                              textAlign: "left",
                                              width: "100%",
                                            }}
                                          >
                                            View subject & message
                                          </span>
                                          <i
                                            className={
                                              expandedTemplateContent[id]
                                                ? "la la-chevron-up"
                                                : "la la-chevron-down"
                                            }
                                            style={{
                                              fontSize: 16,
                                              color: "#6B7280",
                                              flexShrink: 0,
                                            }}
                                          />
                                        </button>
                                        {expandedTemplateContent[id] && (
                                          <div
                                            className="candidate-action-modal-template-content"
                                            style={{
                                              padding: "0 14px 14px 14px",
                                              borderTop: "1px solid #E5E7EB",
                                            }}
                                          >
                                            {templateSubject && (
                                              <div
                                                style={{
                                                  paddingTop: 12,
                                                  marginBottom: templateMessage
                                                    ? 14
                                                    : 0,
                                                }}
                                              >
                                                <span
                                                  style={{
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    color: "#6B7280",
                                                    letterSpacing: "0.02em",
                                                    textTransform: "uppercase",
                                                    display: "block",
                                                    marginBottom: 6,
                                                  }}
                                                >
                                                  Subject
                                                </span>
                                                <div
                                                  style={{
                                                    fontSize: 14,
                                                    fontWeight: 500,
                                                    color: "#111827",
                                                    lineHeight: 1.55,
                                                  }}
                                                  dangerouslySetInnerHTML={{
                                                    __html:
                                                      /<[a-z][\s\S]*>/i.test(
                                                        templateSubject,
                                                      )
                                                        ? templateSubject
                                                        : templateSubject
                                                            .replace(
                                                              /</g,
                                                              "&lt;",
                                                            )
                                                            .replace(
                                                              />/g,
                                                              "&gt;",
                                                            ),
                                                  }}
                                                />
                                              </div>
                                            )}
                                            {templateMessage && (
                                              <div>
                                                <span
                                                  style={{
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    color: "#6B7280",
                                                    letterSpacing: "0.02em",
                                                    textTransform: "uppercase",
                                                    display: "block",
                                                    marginBottom: 6,
                                                  }}
                                                >
                                                  Message
                                                </span>
                                                <div
                                                  style={{
                                                    fontSize: 14,
                                                    color: "#4B5563",
                                                    lineHeight: 1.6,
                                                    maxHeight: 280,
                                                    overflowY: "auto",
                                                    wordBreak: "break-word",
                                                  }}
                                                  dangerouslySetInnerHTML={{
                                                    __html:
                                                      /<[a-z][\s\S]*>/i.test(
                                                        templateMessage,
                                                      )
                                                        ? templateMessage
                                                        : templateMessage
                                                            .split("\n")
                                                            .map(
                                                              (line: string) =>
                                                                line
                                                                  ? `<p style="margin:0 0 8px 0; white-space: pre-wrap;">${line
                                                                      .replace(
                                                                        /</g,
                                                                        "&lt;",
                                                                      )
                                                                      .replace(
                                                                        />/g,
                                                                        "&gt;",
                                                                      )}</p>`
                                                                  : "<br />",
                                                            )
                                                            .join(""),
                                                  }}
                                                />
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {(automation.automation?.from_stage ||
                                      automation.automation?.to_stage) && (
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 8,
                                          fontSize: 12,
                                          color: "#9CA3AF",
                                          marginTop: 2,
                                          justifyContent: "flex-start",
                                          width: "100%",
                                          textAlign: "left",
                                        }}
                                      >
                                        <i
                                          className="la la-arrow-right"
                                          style={{
                                            fontSize: 11,
                                            color: "#D1D5DB",
                                          }}
                                        />
                                        {automation.automation?.from_stage && (
                                          <span>
                                            {automation.automation.from_stage}
                                          </span>
                                        )}
                                        {automation.automation?.from_stage &&
                                          automation.automation?.to_stage && (
                                            <span style={{ color: "#D1D5DB" }}>
                                              →
                                            </span>
                                          )}
                                        {automation.automation?.to_stage && (
                                          <span>
                                            {automation.automation.to_stage}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* <EmailCandidateComponent
                      candidate={candidate}
                      interviewDate={new Date().toLocaleDateString()}
                      action={action}
                      onActionChange={onAction}
                      selectedCareers={candidate?.selectedCareers}
                      endorseFrom={stageMapping.endorseFrom}
                      endorseTo={stageMapping.endorseTo}
                      newStageName={candidate?.toStage}
                      newSubstageName={candidate?.toSubstage}
                    /> */}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 16,
                  width: "100%",
                  marginTop: "24px",
                  flexShrink: 0,
                  padding: "20px 0 8px 0",
                  borderTop: "1px solid #E9EAEB",
                }}
              >
                <Button
                  onClick={handleClose}
                  variant="secondary"
                  label="Cancel"
                ></Button>
                <Button
                  onClick={handleConfirmAction}
                  variant={defaultButtonVariant}
                  label={actions[action]?.buttonText}
                ></Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

      <EditTemplate
        applyChangesToBase={applyChangesToBaseTemplate}
        editorResetKey={templateEditorResetKey}
        formdata={templateEditorFormdata}
        isSaving={isSavingTemplate}
        isVisible={isTemplateEditorVisible}
        saveDisabled={templateEditorSaveDisabled}
        templateName={editingTemplateId ? (templatesMap[editingTemplateId]?.template_name ?? "") : ""}
        onBack={() => setIsTemplateEditorVisible(false)}
        onChange={handleTemplateEditorChange}
        onClose={() => setIsTemplateEditorVisible(false)}
        onSave={handleSaveTemplateChanges}
        onToggleApplyChanges={setApplyChangesToBaseTemplate}
      />
    </>
  );
}
