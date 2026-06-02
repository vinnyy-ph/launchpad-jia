"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/utils/apiClient";
import { Button, Toggle } from "@/lib/components/ui";
import EditTemplate from "@/lib/components/sections/modal-v2/EditTemplate";
import DefaultInviteAutomationCard from "./DefaultInviteAutomationCard";
import { defaultEmailAutomations } from "@/lib/data/emailAutomation";
import axios from "axios";

interface Candidate {
  email: string;
  name?: string;
  image?: string;
}

interface BulkCandidateActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: Candidate[];
  career: {
    _id: string;
    jobTitle: string;
  };
  onAction: (
    action: string,
    data: {
      automationIdsToUse: string[];
      results: { success: number; failed: number };
    }
  ) => void;
  orgID: string;
  user: {
    name?: string;
    email?: string;
    image?: string;
  } | null;
}

interface Automation {
  automation_id?: string;
  _id?: string;
  automation: {
    active: boolean;
    automation_name?: string;
    trigger_on_event: string;
    template_id?: string;
    from_stage?: string;
    to_stage?: string;
  };
  stage_id?: string;
  substage_id?: string;
}

export default function BulkCandidateActionModal({
  isOpen,
  onClose,
  candidates,
  career,
  onAction,
  orgID,
  user,
}: BulkCandidateActionModalProps) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [automationsToUse, setAutomationsToUse] = useState<
    Record<string, boolean>
  >({});
  const [templatesMap, setTemplatesMap] = useState<
    Record<string, {
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
    }>
  >({});
  const [isLoadingAutomations, setIsLoadingAutomations] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
  });
  const [showCandidatesList, setShowCandidatesList] = useState(false);

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

  // Fetch automations when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const fetchAutomation = async () => {
      setIsLoadingAutomations(true);
      try {
        const response = await api.get(
          `/api/emails/automation?orgID=${orgID}&careerId=${career._id}`
        );
        if (cancelled) return;

        const result = await response.data;
        // Merge API automations with defaults (matches CandidateActionModal pattern)
        const mergedAutomations = [
          ...defaultEmailAutomations,
          ...result,
        ];
        // Filter for invite trigger automations (case-insensitive to match CandidateActionModal)
        const filteredAutomations = mergedAutomations.filter(
          (automation: Automation) =>
            automation.automation?.active &&
            automation.automation?.trigger_on_event?.toLowerCase() === "invite"
        );

        if (cancelled) return;
        setAutomations(filteredAutomations);

        // Default all automations to enabled
        const initial: Record<string, boolean> = {};
        if (filteredAutomations.length === 0) {
          initial["default-invite-automation"] = true;
        } else {
          filteredAutomations.forEach((a: Automation) => {
            const id = a.automation_id ?? a._id;
            if (id) initial[String(id)] = true;
          });
        }
        setAutomationsToUse(initial);

        // Fetch templates
        if (orgID) {
          try {
            const authToken =
              typeof window !== "undefined"
                ? localStorage.getItem("authToken")
                : null;
            const templatesRes = await axios.get(
              `/api/emails/templates?orgID=${orgID}`,
              { headers: { Authorization: authToken } }
            );
            if (cancelled) return;
            const templatesList = templatesRes?.data?.templates ?? [];
            const map: Record<string, {
              template_name: string; subject: string; message: string;
              type?: string; creatorEmail?: string;
              enable_schedule_send?: string; schedule_delay?: string; schedule_delay_unit?: string;
              enable_preferred_time?: string; preferred_time?: string;
            }> = {};
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
        if (!cancelled) console.error("Failed to fetch automations:", error);
      } finally {
        if (!cancelled) setIsLoadingAutomations(false);
      }
    };

    fetchAutomation();
    return () => {
      cancelled = true;
    };
  }, [isOpen, orgID, career._id]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsInviting(false);
      setProgress({ current: 0, total: 0, success: 0, failed: 0 });
      setShowCandidatesList(false);
    }
  }, [isOpen]);

  const handleInvite = async () => {
    if (candidates.length === 0 || !user || isInviting) return;

    setIsInviting(true);
    const automationIdsToUse = Object.entries(automationsToUse)
      .filter(([, use]) => use)
      .map(([id]) => id);

    const results = { success: 0, failed: 0 };

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      setProgress({
        current: i + 1,
        total: candidates.length,
        success: results.success,
        failed: results.failed,
      });

      try {
        await api.post("/api/invite-candidate-to-career", {
          targetCareerIds: [career._id],
          candidateEmail: candidate.email,
          invitedBy: {
            name: user.name,
            email: user.email,
            image: user.image,
          },
          orgID: orgID,
          automationIdsToUse,
        });
        results.success++;
      } catch (error) {
        console.error(`Failed to invite ${candidate.email}:`, error);
        results.failed++;
      }

      // Update progress after each candidate
      setProgress({
        current: i + 1,
        total: candidates.length,
        success: results.success,
        failed: results.failed,
      });
    }

    setIsInviting(false);
    onAction("invite", { automationIdsToUse, results });
  };

  if (!isOpen) return null;

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

  const bulkInviteActions = {
    invite: {
      title: "Invite to Job",
      subtext: `You are about to invite <span style="font-weight:700; color:#181D27;">${candidates.length} candidate${candidates.length !== 1 ? "s" : ""}</span> to apply for the <span style="font-weight:700;">${career?.jobTitle || "selected position"}</span> role.`,
      icon: "la-user-plus",
      iconBGColor: "#E0F2FE",
      color: "#0284C7",
    },
  };

  const handleOpenTemplateEditor = (templateId: string) => {
    const t = templatesMap[templateId];
    if (t && !canEditTemplate(templateId)) return;
    const formdata: Record<string, string> = {
      template_name: t?.template_name ?? "",
      subject: t?.subject ?? "",
      message: t?.message ?? "",
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
    if (!activeOrgRaw) return;
    let resolvedOrgID: string;
    try {
      resolvedOrgID = JSON.parse(activeOrgRaw)._id;
      if (!resolvedOrgID) throw new Error();
    } catch { return; }

    const payload = {
      orgID: resolvedOrgID,
      template_name: templateEditorFormdata.template_name?.trim(),
      subject: templateEditorFormdata.subject?.trim(),
      message: templateEditorFormdata.message?.trim(),
      enable_schedule_send: templateEditorFormdata.enable_schedule_send === "true" ? "true" : "false",
      schedule_delay: templateEditorFormdata.enable_schedule_send === "true" ? templateEditorFormdata.schedule_delay || "" : "",
      schedule_delay_unit: templateEditorFormdata.enable_schedule_send === "true" ? templateEditorFormdata.schedule_delay_unit || "Days" : "",
      enable_preferred_time: templateEditorFormdata.enable_preferred_time === "true" ? "true" : "false",
      preferred_time: templateEditorFormdata.enable_preferred_time === "true" ? templateEditorFormdata.preferred_time || "" : "",
    };

    try {
      setIsSavingTemplate(true);
      if (applyChangesToBaseTemplate && editingTemplateId) {
        const response = await api.patch(`/api/emails/templates`, { ...payload, templateID: editingTemplateId });
        setTemplatesMap((prev) => ({
          ...prev,
          [editingTemplateId]: {
            ...prev[editingTemplateId],
            ...payload,
            dateUpdated: response.data?.data?.dateUpdated || new Date().toString(),
          },
        }));
      } else {
        const response = await api.post(`/api/emails/templates`, { ...payload, type: "User", is_copy: true });
        const newId: string = response.data?.data?.template_id ?? response.data?.insertedId;
        if (newId) {
          setTemplatesMap((prev) => ({
            ...prev,
            [newId]: { ...payload, template_id: newId, type: "User", creatorEmail: currentUserEmail ?? "", dateUpdated: new Date().toString() },
          }));
          const affectedAutomations = automations.filter((a: any) => {
            const tid = a.automation?.template_id ?? a.template_id;
            return tid === editingTemplateId;
          });
          await Promise.all(
            affectedAutomations.map(async (a: any) => {
              const automationId = String(a.automation_id ?? a._id ?? "");
              if (!automationId) return;
              const automationObj = a.automation ?? a;
              await api.put(`/api/emails/automation`, { automation_id: automationId, orgID: resolvedOrgID, automation: { ...automationObj, template_id: newId } });
            })
          );
          setAutomations((prev: any[]) =>
            prev.map((a: any) => {
              const tid = a.automation?.template_id ?? a.template_id;
              if (tid !== editingTemplateId) return a;
              if (a.automation) return { ...a, automation: { ...a.automation, template_id: newId } };
              return { ...a, template_id: newId };
            })
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

  const templateEditorSaveDisabled = (() => {
    const requiredKeys = ["template_name", "subject", "message"];
    const hasRequiredValues = requiredKeys.every((key) => Boolean(templateEditorFormdata[key]?.trim()));
    if (!hasRequiredValues) return true;
    if (!applyChangesToBaseTemplate) return false;
    return JSON.stringify(templateEditorFormdata) === JSON.stringify(templateEditorInitialState);
  })();

  return (
    <>
    <div
      className="modal-background fade-in-bottom"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isInviting) onClose();
      }}
    >
      <div className="modal-container">
        <div
          className="modal-content"
          style={{
            maxHeight: "calc(100vh - 40px)",
            maxWidth: "640px",
            width: "100%",
            background: "#fff",
            border: "1.5px solid #E9EAEB",
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(30,32,60,0.18)",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header — horizontal left-aligned */}
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
                  backgroundColor: "#E0F2FE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i
                  className="la la-user-plus"
                  style={{ fontSize: 24, color: "#0284C7" }}
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
                  Bulk Invite Candidates
                </h3>
                <span
                  style={{
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "#535862",
                    textAlign: "left",
                  }}
                >
                  You are about to invite{" "}
                  <span style={{ fontWeight: 600, color: "#181D27" }}>
                    {candidates?.length || 0} candidate
                    {(candidates?.length || 0) !== 1 ? "s" : ""}
                  </span>{" "}
                  to the{" "}
                  <span style={{ fontWeight: 600, color: "#181D27" }}>
                    {career?.jobTitle || "selected position"}
                  </span>{" "}
                  role.
                </span>
              </div>
            </div>
            <button
              onClick={() => { if (!isInviting) onClose(); }}
              style={{
                background: "none",
                border: "none",
                cursor: isInviting ? "not-allowed" : "pointer",
                padding: 0,
                color: "#717680",
                lineHeight: 1,
                opacity: isInviting ? 0.4 : 1,
              }}
            >
              <i className="la la-times" style={{ fontSize: 24 }} />
            </button>
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid #E9EAEB", marginTop: 24 }} />

          {/* Scrollable body */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              padding: "20px 24px 0",
              overflowY: "auto",
              flex: 1,
              minHeight: 0,
            }}
          >
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  .bulk-action-modal-template-content [data-token] { color: #2563EB !important; font-style: italic; }
                  .bulk-modal-edit-tooltip { position: relative; }
                  .bulk-modal-edit-tooltip-text {
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
                  .bulk-modal-edit-tooltip:hover .bulk-modal-edit-tooltip-text {
                    opacity: 1;
                    visibility: visible;
                  }
                `,
              }}
            />

            {/* Candidates Section - Collapsible */}
            <div
              style={{
                border: "1px solid #E9EAEB",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setShowCandidatesList(!showCandidatesList)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "#F9F9FB",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#181D27",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <i className="la la-users" style={{ fontSize: 16, color: "#717680" }} />
                  Selected Candidates ({candidates.length})
                </span>
                <i
                  className={showCandidatesList ? "la la-chevron-up" : "la la-chevron-down"}
                  style={{ fontSize: 16, color: "#717680" }}
                />
              </button>
              {showCandidatesList && (
                <div
                  style={{
                    maxHeight: 200,
                    overflowY: "auto",
                    padding: "8px 16px 12px",
                    borderTop: "1px solid #E9EAEB",
                  }}
                >
                  {candidates.map((candidate, index) => (
                    <div
                      key={candidate.email}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 0",
                        borderBottom: index < candidates.length - 1 ? "1px solid #F3F4F6" : "none",
                      }}
                    >
                      {candidate.image ? (
                        <img
                          src={candidate.image}
                          alt={candidate.name || candidate.email}
                          style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: "#E5E7EB",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <i className="la la-user" style={{ fontSize: 14, color: "#9CA3AF" }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: "#181D27",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {candidate.name || candidate.email}
                        </div>
                        {candidate.name && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#717680",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {candidate.email}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Email Automations section */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 500, color: "#181D27" }}>
                Email Automations
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.5, color: "#535862" }}>
                You can enable or disable active automations to run for this action
              </span>
            </div>

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
                <i className="la la-spinner la-spin" style={{ fontSize: 28, color: "#0284C7" }} />
                <span>Loading automations...</span>
              </div>
            ) : automations.length === 0 ? (
              <DefaultInviteAutomationCard
                candidate={candidates}
                actions={bulkInviteActions}
                automationsToUse={automationsToUse}
                setAutomationsToUse={setAutomationsToUse}
                isBulk={true}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
                {automations.map((automation: Automation) => {
                  const id = String(automation.automation_id ?? automation._id ?? "");
                  const useForAction = automationsToUse[id] ?? true;
                  const name = automation.automation?.automation_name ?? "Automation";
                  const templateId = automation.automation?.template_id;
                  const templateInfo = templateId ? templatesMap[templateId] : null;
                  const templateName = templateInfo
                    ? templateInfo.template_name
                    : (templateId ?? "Template unavailable");
                  const templateSubject = templateInfo?.subject ?? "";
                  const templateMessage = templateInfo?.message ?? "";
                  const previewAvailable = Boolean(templateSubject) || Boolean(templateMessage);

                  return (
                    <div
                      key={id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0,
                        width: "100%",
                        background: "#FDFDFD",
                        border: `1px solid ${useForAction ? "#E9EAEB" : "#F2F4F7"}`,
                        borderRadius: 12,
                        boxShadow: "0px 1px 2px 0px rgba(10, 13, 18, 0.05)",
                        opacity: useForAction ? 1 : 0.72,
                      }}
                    >
                      {/* Card header row */}
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
                            <i className="la la-bolt" style={{ fontSize: 13, color: "#12B76A" }} />
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
                              !isInviting &&
                              setAutomationsToUse((prev) => ({ ...prev, [id]: checked }))
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

                      {/* Inner white template card */}
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
                              {templatesMap[templateId]?.type || "System"}
                            </span>
                          </div>

                          {/* Edit button — matches CandidateActionModal */}
                          {(() => {
                            const canEdit = templateId ? canEditTemplate(templateId) : true;
                            const tooltipText = templateId ? getEditTooltip(templateId) : "";
                            return (
                              <div
                                style={{ position: "relative", display: "inline-flex" }}
                                className="bulk-modal-edit-tooltip"
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
                                      "0px 0.833px 1.667px 0px rgba(10,13,18,0.05), inset 0px -1.667px 0px 0px rgba(10,13,18,0.05), inset 0px 0px 0px 0.833px rgba(10,13,18,0.18)",
                                    padding: 0,
                                  }}
                                  onClick={() => {
                                    if (canEdit && templateId) handleOpenTemplateEditor(templateId);
                                  }}
                                >
                                  <i className="la la-pen" style={{ fontSize: 14 }} />
                                </button>
                                {tooltipText && (
                                  <span className="bulk-modal-edit-tooltip-text">
                                    {tooltipText}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {previewAvailable && (() => {
                          const jobTitle = career.jobTitle || "Selected role";
                          const candidateLabel =
                            candidates.length > 1
                              ? `${candidates.length} candidates`
                              : candidates[0]?.name || candidates[0]?.email || "Candidate";
                          const previewHeaderHtml = [
                            { value: jobTitle, color: "#175CD3", weight: 500 },
                            { value: "—", color: "#414651", weight: 400 },
                            { value: candidateLabel, color: "#175CD3", weight: 500 },
                          ]
                            .map(
                              ({ value, color, weight }) =>
                                `<span style="color:${color}; font-weight:${weight};">${String(value)
                                  .replace(/&/g, "&amp;")
                                  .replace(/</g, "&lt;")
                                  .replace(/>/g, "&gt;")}</span>`
                            )
                            .join(" ");

                          const previewBodyHtml = [templateSubject, templateMessage]
                            .filter(Boolean)
                            .map((content, index) => {
                              if (!content) return "";
                              if (/<[a-z][\s\S]*>/i.test(content)) {
                                return index === 0
                                  ? `<div style="margin:0 0 12px 0; font-weight:500; color:#181D27;">${content}</div>`
                                  : `<div style="margin:0; color:#181D27;">${content}</div>`;
                              }
                              const safe = content
                                .replace(/&/g, "&amp;")
                                .replace(/</g, "&lt;")
                                .replace(/>/g, "&gt;");
                              return safe
                                .split("\n")
                                .map((line: string, i: number) =>
                                  line
                                    ? `<p style="margin:0 0 ${i === safe.split("\n").length - 1 ? 0 : 8}px 0; white-space:pre-wrap; ${index === 0 ? "font-weight:500;" : ""}">${line}</p>`
                                    : "<br />"
                                )
                                .join("");
                            })
                            .join(
                              templateSubject && templateMessage
                                ? '<div style="height:12px;"></div>'
                                : ""
                            );

                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                              <div
                                style={{
                                  fontSize: 14,
                                  lineHeight: 1.6,
                                  color: "#181D27",
                                  textAlign: "left",
                                  wordBreak: "break-word",
                                }}
                                dangerouslySetInnerHTML={{ __html: previewHeaderHtml }}
                              />
                              <div style={{ borderTop: "1px solid #E9EAEB" }} />
                              <div
                                className="bulk-action-modal-template-content"
                                style={{
                                  fontSize: 14,
                                  lineHeight: 1.6,
                                  color: "#181D27",
                                  textAlign: "left",
                                  wordBreak: "break-word",
                                  maxHeight: 220,
                                  overflowY: "auto",
                                }}
                                dangerouslySetInnerHTML={{ __html: previewBodyHtml }}
                              />
                            </div>
                          );
                        })()}

                        {!previewAvailable && (
                          <span style={{ fontSize: 14, lineHeight: 1.5, color: "#535862", textAlign: "left" }}>
                            No template preview available for this automation.
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Progress Section */}
            {isInviting && (
              <div
                style={{
                  padding: "16px",
                  background: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
                  borderRadius: 12,
                  border: "1px solid #BBF7D0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#166534" }}>
                    <i className="la la-spinner la-spin" style={{ marginRight: 8 }} />
                    Inviting candidates...
                  </span>
                  <span style={{ fontSize: 14, color: "#166534" }}>
                    {progress.current} of {progress.total}
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 8,
                    background: "#E5E7EB",
                    borderRadius: 4,
                    overflow: "hidden",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #10B981 0%, #059669 100%)",
                      borderRadius: 4,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                  <span style={{ color: "#059669" }}>
                    <i className="la la-check" style={{ marginRight: 4 }} />
                    Success: {progress.success}
                  </span>
                  {progress.failed > 0 && (
                    <span style={{ color: "#DC2626" }}>
                      <i className="la la-times" style={{ marginRight: 4 }} />
                      Failed: {progress.failed}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Bottom padding spacer */}
            <div style={{ height: 4 }} />
          </div>

          {/* Footer — right-aligned */}
          <div
            style={{
              borderTop: "1px solid #E9EAEB",
              padding: "24px",
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              flexWrap: "wrap",
              flexShrink: 0,
            }}
          >
            <Button
              onClick={() => { if (!isInviting) onClose(); }}
              disabled={isInviting}
              variant="secondary"
              label="Cancel"
            />
            <Button
              onClick={handleInvite}
              disabled={isInviting || candidates.length === 0}
              variant="primary"
              label={
                isInviting
                  ? `Inviting (${progress.current}/${progress.total})`
                  : `Invite (${candidates.length})`
              }
            />
          </div>
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
