"use client";

import { useState } from "react";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/utils/emailTemplateDefaults";
import { Toggle } from "../ui";

interface DefaultInviteAutomationCardProps {
  candidate: any;
  actions: Record<string, any>;
  automationsToUse: Record<string, boolean>;
  setAutomationsToUse: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isBulk?: boolean;
}

export default function DefaultInviteAutomationCard({
  candidate,
  actions,
  automationsToUse,
  setAutomationsToUse,
  isBulk = false,
}: DefaultInviteAutomationCardProps) {
  const [expanded, setExpanded] = useState(false);

  const automationId = "default-invite-automation";
  const useForAction = automationsToUse[automationId] ?? true;

  // Get replaced subject
  const getSubject = () => {
    const template = DEFAULT_EMAIL_TEMPLATES.invite;
    
    // For bulk, keep placeholders; for single, use actual data
    const fullName = isBulk ? "[[Candidate Full Name]]" : (candidate?.name || "Candidate");
    const jobTitles = isBulk 
      ? "[[Job Titles List]]"
      : (candidate?.selectedCareers?.map((c: any) => c.jobTitle).join(", ") || "selected position");
    
    return template.subject
      .replace(/\[\[Candidate Full Name\]\]/g, fullName)
      .replace(/\[\[Employer Company Name\]\]/g, "[[Your Company]]")
      .replace(/\[\[Job Titles List\]\]/g, jobTitles);
  };

  // Get replaced message body
  const getMessage = () => {
    const template = DEFAULT_EMAIL_TEMPLATES.invite;
    
    // For bulk, keep placeholders; for single, use actual data
    const firstName = isBulk 
      ? "[[Candidate First Name]]" 
      : (candidate?.name?.split(" ")[0] || "Candidate");
    const fullName = isBulk 
      ? "[[Candidate Full Name]]" 
      : (candidate?.name || "Candidate");
    const jobTitlesList = isBulk
      ? "[[Job Titles List]]"
      : (candidate?.selectedCareers?.length > 1
          ? `<ul>${candidate.selectedCareers.map((c: any) => `<li>${c.jobTitle}</li>`).join("")}</ul>`
          : candidate?.selectedCareers?.[0]?.jobTitle || "selected position");
    
    return template.body
      .replace(/\[\[Candidate First Name\]\]/g, firstName)
      .replace(/\[\[Candidate Full Name\]\]/g, fullName)
      .replace(/\[\[Employer Company Name\]\]/g, "[[Your Company]]")
      .replace(/\[\[Job Titles List\]\]/g, jobTitlesList)
      .replace(/\[\[JIA Job Portal Link\]\]/g, "#");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        width: "100%",
        padding: "20px 18px 20px 24px",
        background: "linear-gradient(145deg, #FFFFFF 0%, #F8FDFA 100%)",
        border: "1px solid #DDE4EC",
        borderRadius: 14,
        boxShadow: "0 3px 14px rgba(5, 150, 105, 0.07), 0 1px 4px rgba(0,0,0,0.05)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Green left border */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background:
            "linear-gradient(180deg, #10B981 0%, #059669 50%, #047857 100%)",
          borderRadius: "14px 0 0 14px",
        }}
      />

      {/* Header row with title and badge */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
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
            {actions["invite"]?.title}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: 6,
              background: "linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)",
              color: "#047857",
            }}
          >
            Default
          </span>
        </div>
        
        {/* Toggle control */}
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
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
                [automationId]: checked,
              }))
            }
          />
        </div>
      </div>

      {/* Content row with icon and details */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          paddingLeft: 4,
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: actions["invite"]?.iconBGColor || "#E0F2FE",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <i
            className={`la ${actions["invite"]?.icon}`}
            style={{
              fontSize: 20,
              color: actions["invite"]?.color || "#0284C7",
            }}
          />
        </div>

        {/* Text and expandable section */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flex: 1,
          }}
        >
          {/* Subtext */}
          <span
            style={{
              fontSize: 14,
              color: "#4B5563",
              lineHeight: 1.5,
            }}
            dangerouslySetInnerHTML={{ __html: actions["invite"]?.subtext }}
          />

          {/* View subject & message expandable section */}
          <div
            style={{
              marginTop: 12,
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
              onClick={() => setExpanded(!expanded)}
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
                className={expanded ? "la la-chevron-up" : "la la-chevron-down"}
                style={{
                  fontSize: 16,
                  color: "#6B7280",
                  flexShrink: 0,
                }}
              />
            </button>

            {expanded && (
              <div
                style={{
                  padding: "0 14px 14px 14px",
                  borderTop: "1px solid #E5E7EB",
                }}
              >
                {/* Subject */}
                <div
                  style={{
                    paddingTop: 12,
                    marginBottom: 14,
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
                  >
                    {getSubject()}
                  </div>
                </div>

                {/* Message */}
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
                    dangerouslySetInnerHTML={{ __html: getMessage() }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
