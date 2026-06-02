"use client";

import { useState } from "react";
import { api } from "@/lib/utils/apiClient";
import { candidateActionToast, errorToast } from "@/lib/Utils";

interface OrgAccessToggleProps {
  orgId: string;
  status: "active" | "inactive";
  onStatusChange: (status: "active" | "inactive") => void;
}

export default function OrgAccessToggle({ orgId, status, onStatusChange }: OrgAccessToggleProps) {
  const [isToggling, setIsToggling] = useState(false);
  const isActive = status === "active";

  const handleToggle = async () => {
    const newStatus = isActive ? "inactive" : "active";
    
    setIsToggling(true);
    try {
      await api.patch("/api/admin/toggle-org-access", {
        orgId,
        status: newStatus,
      });
      onStatusChange(newStatus);
      candidateActionToast(
        `Organization ${newStatus === "active" ? "activated" : "deactivated"}`,
        1300,
        <i className={`la ${newStatus === "active" ? "la-check-circle text-success" : "la-times-circle text-danger"}`} />
      );
    } catch (error) {
      errorToast("Error updating organization status", 1300);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div
      style={{
        background: "#F8F9FC",
        borderRadius: 16,
        padding: 8,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "inset 0px 0px 2px 0px rgba(0,16,53,0.16)",
        }}
      >
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0 }}>
            Organization Access
          </h3>
          <p style={{ fontSize: 14, color: "#717680", margin: 0, marginTop: 4 }}>
            {isActive
              ? "Organization has access to their Jia Recruiter Portal"
              : "Organization access is disabled"}
          </p>
        </div>

        <button
          onClick={handleToggle}
          disabled={isToggling}
          style={{
            width: 52,
            height: 28,
            borderRadius: 14,
            border: "none",
            background: isActive ? "#12B76A" : "#E9EAEB",
            cursor: isToggling ? "wait" : "pointer",
            position: "relative",
            transition: "background 0.2s ease",
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "#fff",
              position: "absolute",
              top: 2,
              left: isActive ? 26 : 2,
              transition: "left 0.2s ease",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        </button>
      </div>
    </div>
  );
}
