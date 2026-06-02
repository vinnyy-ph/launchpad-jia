"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Label } from "@/lib/components/GuestPortalComponents/label";
import { FIT_STATUS_MAP, getBaseFitStatus } from "@/lib/components/GuestPortalComponents/Careers/ViewCareer/types";
import { useCandidateHoverCardData } from "./useCandidateHoverCardData";

type CandidateHoverCardProps = {
  candidate: {
    name: string;
    email: string;
    avatar?: string;
    fit?: string;
    timeAgo?: string;
    endorsedBy?: string;
    endorsedByAvatar?: string;
  };
  guestOrgId: string | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  anchorRect?: DOMRect | null;
  usePortal?: boolean;
};

export function CandidateHoverCard({
  candidate,
  guestOrgId,
  onMouseEnter,
  onMouseLeave,
  anchorRect,
  usePortal,
}: CandidateHoverCardProps) {
  const baseFitStatus = getBaseFitStatus(candidate.fit);
  const { isLoading, phone, location, resolvedSkills } = useCandidateHoverCardData(candidate.email, guestOrgId);

  const isClient = typeof window !== "undefined";
  const shouldPortal = !!(isClient && usePortal && anchorRect);
  const willFlipUp = shouldPortal && anchorRect ? window.innerHeight - anchorRect.bottom < 420 : false;

  const phoneLabel = phone ? phone : "No phone";
  const locationLabel = location ? location : "No location";

  const hoverNode = (
    <div
      style={{
        position: shouldPortal ? "fixed" : "absolute",
        top: shouldPortal && anchorRect
          ? willFlipUp
            ? Math.max(8, anchorRect.top - 8)
            : Math.min(window.innerHeight - 8, anchorRect.bottom + 8)
          : 58,
        left: shouldPortal && anchorRect
          ? Math.min(window.innerWidth - 8, Math.max(8, anchorRect.left))
          : 12,
        transform: shouldPortal && anchorRect
          ? willFlipUp
            ? "translateY(-100%)"
            : "translateY(0)"
          : "translateY(0)",
        width: "clamp(260px, 40vw, 380px)",
        background: "#fff",
        border: "1px solid #EAECF0",
        borderRadius: 12,
        boxShadow: "0px 12px 16px -4px rgba(16, 24, 40, 0.08)",
        zIndex: 1000,
        padding: 12,
        pointerEvents: "auto",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img
          src={candidate.avatar || "/default-avatar.png"}
          alt=""
          style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#101828",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={candidate.name}
          >
            {candidate.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#667085",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={candidate.email}
          >
            {candidate.email}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: "#EAECF0", margin: "10px 0" }} />

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#344054", marginBottom: 8 }}>Endorsed by</div>
        {candidate.endorsedBy ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img
              src={candidate.endorsedByAvatar || "/maybe-fit-avatar.png"}
              alt=""
              style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
            />
            <span style={{ fontSize: 12, color: "#667085" }}>
              Endorsed by <span style={{ fontWeight: 600, color: "#344054" }}>{candidate.endorsedBy}</span>
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "#6B7280" }}>Not endorsed yet</span>
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#344054", marginBottom: 8 }}>Contact Details</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: "999px",
              backgroundColor: "#F3F4F6",
              border: "1px solid #E5E7EB",
              maxWidth: "100%",
            }}
          >
            <span style={{ fontSize: 12, color: "#374151", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
              {candidate.email}
            </span>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: "999px",
              backgroundColor: "#F3F4F6",
              border: "1px solid #E5E7EB",
              maxWidth: "100%",
            }}
          >
            <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{isLoading ? "Loading…" : phoneLabel}</span>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: "999px",
              backgroundColor: "#F3F4F6",
              border: "1px solid #E5E7EB",
              maxWidth: "100%",
            }}
          >
            <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{isLoading ? "Loading…" : locationLabel}</span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#344054", marginBottom: 8 }}>Skills</div>
        {isLoading ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                style={{
                  minWidth: 80,
                  height: 24,
                  borderRadius: "999px",
                  backgroundColor: "#E5E7EB",
                }}
              />
            ))}
          </div>
        ) : resolvedSkills.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {resolvedSkills.slice(0, 24).map((skill: string, idx: number) => (
              <span
                key={`${skill}-${idx}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  backgroundColor: "#F3F4F6",
                  border: "1px solid #E5E7EB",
                  fontSize: 12,
                  color: "#374151",
                  fontWeight: 500,
                }}
              >
                {skill}
              </span>
            ))}
            {resolvedSkills.length > 24 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  border: "1px dashed #E5E7EB",
                  backgroundColor: "#F9FAFB",
                  fontSize: 12,
                  color: "#6B7280",
                  fontWeight: 500,
                }}
              >
                {resolvedSkills.length - 24} more
              </span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "#6B7280" }}>No skills listed.</span>
        )}
      </div>

      {(candidate.fit || candidate.timeAgo) && <div style={{ height: 1, background: "#EAECF0", margin: "10px 0" }} />}

      {candidate.fit ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {(() => {
            if (baseFitStatus) {
              const { bgColor, borderColor, textColor } = FIT_STATUS_MAP[baseFitStatus];
              return (
                <Label bgColor={bgColor} textColor={textColor} strokeColor={borderColor}>
                  {candidate.fit}
                </Label>
              );
            }

            return (
              <Label bgColor="#F2F4F7" textColor="#344054" strokeColor="#E4E7EC">
                {candidate.fit}
              </Label>
            );
          })()}
          {candidate.timeAgo ? <span style={{ fontSize: 12, color: "#98A2B3" }}>{candidate.timeAgo}</span> : null}
        </div>
      ) : candidate.timeAgo ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <span style={{ fontSize: 12, color: "#98A2B3" }}>{candidate.timeAgo}</span>
        </div>
      ) : null}
    </div>
  );

  if (shouldPortal) {
    return createPortal(hoverNode, document.body);
  }

  return hoverNode;
}

