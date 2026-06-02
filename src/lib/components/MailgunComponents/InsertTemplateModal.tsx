"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/utils/apiClient";
import { Template } from "@/lib/components/sections";

type TemplateType = "user" | "global" | "system";

type EmailTemplate = {
  _id: string;
  name: string;
  subject: string;
  messageContent?: string;
  fullMessage?: string;
  templateType?: TemplateType;
  action?: string;
  dateCreated?: string | number | Date;
  dateUpdated?: string | number | Date;
  userEmail?: string;
  orgID?: string;
  isActive?: boolean;
};

type InsertTemplateModalProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (payload: {
    subject: string;
    body: string;
    template?: EmailTemplate;
  }) => void;
};

const TAB_CONFIG: { key: TemplateType; label: string; helper: string }[] = [
  {
    key: "user",
    label: "User",
    helper: "Templates you created",
  },
  {
    key: "global",
    label: "Global",
    helper: "Shared with your org",
  },
  {
    key: "system",
    label: "System",
    helper: "Built-in defaults",
  },
];

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: "48px 16px",
  zIndex: 1100,
  overflowY: "auto",
};

const modalStyle: React.CSSProperties = {
  width: "960px",
  maxWidth: "100%",
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 12px 40px rgba(0,0,0,0.16)",
  padding: 24,
  position: "relative",
  color: "#111827",
};

export default function InsertTemplateModal({
  open,
  onClose,
  onInsert,
}: InsertTemplateModalProps) {
  const [activeTab, setActiveTab] = useState<TemplateType>("user");
  const [templatesByType, setTemplatesByType] = useState<
    Record<TemplateType, EmailTemplate[]>
  >({
    user: [],
    global: [],
    system: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] =
    useState<EmailTemplate | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setSelectedTemplate(null);
    fetchAllTemplates();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const getOrgAndUser = () => {
    let orgId: string | null = null;
    let userEmail: string | null = null;

    const activeOrgRaw =
      typeof window !== "undefined" ? localStorage.getItem("activeOrg") : null;
    if (activeOrgRaw) {
      try {
        const parsed = JSON.parse(activeOrgRaw);
        orgId = parsed?._id || parsed?.id || null;
      } catch (e) {
        orgId = null;
      }
    }

    const storedUserRaw =
      typeof window !== "undefined" ? localStorage.getItem("user") : null;
    if (storedUserRaw) {
      try {
        const parsedUser = JSON.parse(storedUserRaw);
        const possibleFields = [
          "email",
          "Email",
          "EMAIL",
          "userEmail",
          "user_email",
          "e_mail",
        ];
        for (const field of possibleFields) {
          if (parsedUser[field]) {
            userEmail = parsedUser[field];
            break;
          }
        }
      } catch (e) {
        userEmail = null;
      }
    }

    return { orgId, userEmail };
  };

  const fetchAllTemplates = async () => {
    const { orgId } = getOrgAndUser();

    if (!orgId) {
      setError("Organization not found. Please select an organization first.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Note: api.get automatically adds the Bearer token from localStorage via interceptor
      const res = await api.get(
        `/api/mailgun-module/mg-fetch-templates?orgID=${orgId}`
      );

      const raw: any[] = res?.data?.templates || [];

      const grouped: Record<TemplateType, EmailTemplate[]> = {
        user: [],
        global: [],
        system: [],
      };

      raw.forEach((t) => {
        const typeRaw = (t.type || "").toString().toLowerCase();
        const mappedType: TemplateType =
          typeRaw === "global"
            ? "global"
            : typeRaw === "system"
            ? "system"
            : "user";

        grouped[mappedType].push({
          _id: t.template_id || t._id || "",
          name: t.template_name || t.name || "",
          subject: t.subject || "",
          messageContent: t.message || "",
          fullMessage: t.message || "",
          templateType: mappedType,
          action: undefined,
          dateCreated: t.date_created || t.dateCreated,
          dateUpdated: t.date_updated || t.dateUpdated,
          userEmail: t.creator?.email || undefined,
          orgID: t.orgID || orgId,
          isActive: true,
        });
      });

      setTemplatesByType(grouped);
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to fetch templates.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (value?: string | number | Date) => {
    if (!value) return "";
    try {
      const date = new Date(value);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return "";
    }
  };

  const resolveBody = (template?: EmailTemplate) => {
    if (!template) return "";
    return (
      template.messageContent || template.fullMessage || template.subject || ""
    );
  };

  const activeTemplates = useMemo(
    () => templatesByType[activeTab] || [],
    [templatesByType, activeTab]
  );

  if (!open) return null;

  return (
    <div style={overlayStyle} onClick={onClose} className="fade-in-bottom">
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                marginBottom: 4,
                color: "#0F172A",
              }}
            >
              Insert email template
            </div>
            <div style={{ color: "#6B7280", fontSize: 14 }}>
              Browse saved templates or preview before inserting.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "1px solid #E5E7EB",
              background: "#fff",
              borderRadius: 10,
              width: 36,
              height: 36,
              display: "grid",
              placeItems: "center",
              color: "#6B7280",
              cursor: "pointer",
            }}
          >
            <i className="las la-times"></i>
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              borderBottom: "1px solid #E5E7EB",
              paddingBottom: 8,
            }}
          >
            {TAB_CONFIG.map((tab) => {
              const isActive = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 2,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: isActive
                      ? "1px solid #111827"
                      : "1px solid #E5E7EB",
                    background: isActive ? "#F3F4F6" : "#fff",
                    color: "#111827",
                    cursor: "pointer",
                    minWidth: 120,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    {tab.label}
                  </span>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>
                    {tab.helper}
                  </span>
                </button>
              );
            })}
          </div>

          {error && (
            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: 10,
                background: "#FEF2F2",
                color: "#B91C1C",
                border: "1px solid #FECACA",
              }}
            >
              {error}
            </div>
          )}

          {/* Templates Table View */}
          {!selectedTemplate && (
            <div
              style={{
                marginTop: 16,
                border: "1px solid #E5E7EB",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: "#F9FAFB",
                  borderBottom: "1px solid #E5E7EB",
                }}
              >
                <span style={{ fontWeight: 600, color: "#111827" }}>
                  {TAB_CONFIG.find((t) => t.key === activeTab)?.label} templates
                </span>
                {isLoading && (
                  <span style={{ color: "#6B7280", fontSize: 14 }}>
                    <i className="la la-circle-notch la-spin"></i> Loading...
                  </span>
                )}
              </div>

              {activeTemplates.length === 0 && !isLoading ? (
                <div
                  style={{
                    padding: "32px 16px",
                    textAlign: "center",
                    color: "#6B7280",
                  }}
                >
                  No templates found for this tab.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      minWidth: 640,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#F9FAFB", color: "#6B7280" }}>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "10px 16px",
                            fontSize: 12,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Name
                        </th>
                        <th style={{ textAlign: "left", padding: "10px 16px" }}>
                          Subject
                        </th>
                        <th style={{ textAlign: "left", padding: "10px 16px" }}>
                          Action
                        </th>
                        <th style={{ textAlign: "left", padding: "10px 16px" }}>
                          Updated
                        </th>
                        <th style={{ textAlign: "left", padding: "10px 16px" }}>
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTemplates.map((template) => (
                        <tr
                          key={template._id}
                          onClick={() => setSelectedTemplate(template)}
                          style={{
                            cursor: "pointer",
                            borderTop: "1px solid #F3F4F6",
                            transition: "background 0.12s ease",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#F9FAFB")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                            {template.name || "Untitled"}
                          </td>
                          <td
                            style={{ padding: "12px 16px", color: "#374151" }}
                          >
                            {template.subject || "—"}
                          </td>
                          <td
                            style={{ padding: "12px 16px", color: "#6B7280" }}
                          >
                            {template.action
                              ? template.action.toUpperCase()
                              : "—"}
                          </td>
                          <td
                            style={{ padding: "12px 16px", color: "#6B7280" }}
                          >
                            {formatDate(
                              template.dateUpdated || template.dateCreated
                            )}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            {template.isActive === false ? (
                              <span
                                style={{
                                  background: "#FEF2F2",
                                  color: "#B91C1C",
                                  padding: "4px 8px",
                                  borderRadius: 8,
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                Inactive
                              </span>
                            ) : (
                              <span
                                style={{
                                  background: "#ECFDF3",
                                  color: "#15803D",
                                  padding: "4px 8px",
                                  borderRadius: 8,
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                Active
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Preview View */}
          {selectedTemplate && (
            <div
              style={{
                marginTop: 16,
                border: "1px solid #E5E7EB",
                borderRadius: 12,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() => setSelectedTemplate(null)}
                  style={{
                    border: "1px solid #E5E7EB",
                    background: "#fff",
                    borderRadius: 10,
                    padding: "8px 12px",
                    cursor: "pointer",
                    color: "#111827",
                    fontWeight: 600,
                  }}
                >
                  <i
                    className="las la-arrow-left"
                    style={{ marginRight: 6 }}
                  ></i>
                  Back to templates
                </button>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    style={{
                      border: "1px solid #E5E7EB",
                      background: "#fff",
                      borderRadius: 10,
                      padding: "8px 12px",
                      cursor: "pointer",
                      color: "#111827",
                      fontWeight: 600,
                    }}
                  >
                    Close preview
                  </button>
                  <button
                    onClick={() =>
                      onInsert({
                        subject: selectedTemplate.subject || "",
                        body: resolveBody(selectedTemplate),
                        template: selectedTemplate,
                      })
                    }
                    style={{
                      border: "none",
                      background: "#111827",
                      color: "#fff",
                      borderRadius: 10,
                      padding: "10px 16px",
                      cursor: "pointer",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <i className="la la-file-import"></i>
                    Insert to email
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    padding: "6px 10px",
                    background: "#EEF2FF",
                    color: "#3730A3",
                    borderRadius: 8,
                    fontWeight: 700,
                    textTransform: "capitalize",
                  }}
                >
                  {selectedTemplate.templateType || ""}
                </div>
                {selectedTemplate.action && (
                  <div
                    style={{
                      padding: "6px 10px",
                      background: "#F3F4F6",
                      color: "#111827",
                      borderRadius: 8,
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    {selectedTemplate.action}
                  </div>
                )}
                <div style={{ color: "#6B7280", fontSize: 12 }}>
                  Updated{" "}
                  {formatDate(
                    selectedTemplate.dateUpdated || selectedTemplate.dateCreated
                  ) || "recently"}
                </div>
              </div>

              <div>
                <div
                  style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}
                >
                  {selectedTemplate.name}
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <Template
                  subject={selectedTemplate.subject || ""}
                  message={resolveBody(selectedTemplate) || ""}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
