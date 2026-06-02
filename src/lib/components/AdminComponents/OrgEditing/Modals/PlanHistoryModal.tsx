"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/utils/apiClient";
import { errorToast } from "@/lib/Utils";
import { PlanHistoryEntry } from "@/lib/types/organization";
import PricingPlanBadge from "../../PricingPlans/PricingPlanBadge";

interface PlanHistoryModalProps {
  orgId: string;
  onClose: () => void;
}

export default function PlanHistoryModal({ orgId, onClose }: PlanHistoryModalProps) {
  const [history, setHistory] = useState<
    (PlanHistoryEntry & { isCurrent?: boolean; appliedByAvatar?: string })[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.get("/api/pricing-plan/admin/get-org-plan-history", {
          params: { orgId },
        });
        setHistory(response.data.planHistory || []);
      } catch (error) {
        console.error("Error fetching plan history:", error);
        errorToast("Error fetching plan history", 1300);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [orgId]);

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getActionLabel = (action: string) => {
    // Standardize legacy labels for consistency
    if (action === "applied") return "Applied Plan";
    if (action === "Applied") return "Applied Plan";
    if (action === "schedule_edited") return "Edited Plan Schedule";
    return action;
  };

  const getDisplayName = (value: string) => {
    if (!value) return "-";

    if (value.includes("@")) {
      const [localPart] = value.split("@");
      const segments = localPart.split(/[._\s]+/).filter(Boolean);

      if (segments.length === 0) return value;

      return segments
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ");
    }

    return value;
  };

  const getInitials = (value: string) => {
    if (!value) return "";

    const display = getDisplayName(value);
    const parts = display.split(" ").filter(Boolean);

    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }

    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "90%",
          maxWidth: 1000,
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            borderBottom: "1px solid #E9EAEB",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#181D27", margin: 0 }}>
            Plan History
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
            }}
          >
            <i className="la la-times" style={{ fontSize: 20, color: "#535862" }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {isLoading ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <i className="la la-spinner la-spin" style={{ fontSize: 32, color: "#717680" }} />
            </div>
          ) : history.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <i className="la la-history" style={{ fontSize: 48, color: "#E9EAEB" }} />
              <p style={{ color: "#717680", marginTop: 12 }}>No plan history available</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8F9FC" }}>
                  <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#717680" }}>
                    Plan
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#717680" }}>
                    Schema
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#717680" }}>
                    Start Date
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#717680" }}>
                    End Date
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#717680" }}>
                    Action
                  </th>
                  <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#717680" }}>
                    Applied by
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, index) => {
                  const avatarUrl = entry.appliedByAvatar;
                  return (
                    <tr key={index} style={{ borderTop: "1px solid #E9EAEB" }}>
                      <td style={{ padding: "12px 24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                            {entry.planName}
                          </span>
                          {entry.isCurrent && (
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 10,
                                fontWeight: 600,
                                background: "#ECFDF3",
                                color: "#027A48",
                              }}
                            >
                              Current
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <PricingPlanBadge schema={entry.schemaType} />
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 14, color: "#181D27" }}>
                        {formatDate(entry.startDate)}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 14, color: "#181D27" }}>
                        {formatDate(entry.endDate)}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 14, color: "#717680" }}>
                        {getActionLabel(entry.action)}
                      </td>
                      <td style={{ padding: "12px 24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              backgroundColor: "#E9ECEF",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 14,
                              fontWeight: 600,
                              color: "#6C757D",
                              overflow: "hidden",
                              flexShrink: 0,
                            }}
                          >
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={entry.appliedBy}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              getInitials(entry.appliedBy)
                            )}
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                            {getDisplayName(entry.appliedBy)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
