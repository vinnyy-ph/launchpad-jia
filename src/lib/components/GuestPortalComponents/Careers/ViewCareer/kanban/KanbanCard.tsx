"use client";

import React from "react";
import type { CandidateCard } from "./types";
import { Label } from "@/lib/components/GuestPortalComponents/label";
import { FIT_STATUS_MAP, getBaseFitStatus } from "@/lib/components/GuestPortalComponents/Careers/ViewCareer/types";

export default function KanbanCard({
  card,
  isDropdownOpen,
  onToggleDropdown,
  onCloseDropdown,
  onViewAnalysis,
}: {
  card: CandidateCard;
  isDropdownOpen: boolean;
  onToggleDropdown: () => void;
  onCloseDropdown: () => void;
  onViewAnalysis?: () => void;
}) {
  const baseFitStatus = getBaseFitStatus(card.fit);
  const hasFit = Boolean(card.fit);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onCloseDropdown();
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isDropdownOpen, onCloseDropdown]);

  return (
    <div
      style={{
        background: baseFitStatus === "Retake" ? "#FFFCF5" : "#fff",
        border: baseFitStatus === "Retake" ? "1px solid #FEEFC7" : "1px solid #EAECF0",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        position: "relative",
      }}
    >
      {hasFit && baseFitStatus && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {(() => {
            const { bgColor, borderColor, textColor, text } = FIT_STATUS_MAP[baseFitStatus];

            return (
              <Label
                bgColor={bgColor}
                textColor={textColor}
                strokeColor={borderColor}
              >
                {baseFitStatus === "Strong fit" && (
                  <img
                    src="/iconsV3/star-green.svg"
                    alt="Strong fit"
                    style={{ width: 12, height: 12, display: "block" }}
                  />
                )}
                {card.fit}
              </Label>
            );
          })()}
          <div style={{ position: "relative" }} ref={dropdownRef}>
            <button
              aria-label="More"
              onClick={onToggleDropdown}
              style={{
                border: 0,
                background: "transparent",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <img src="/iconsV3/more-horizontal.svg" alt="" style={{ width: 20, height: 20, display: "block" }} />
            </button>
            {isDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  background: "#fff",
                  border: "1px solid #EAECF0",
                  borderRadius: 12,
                  boxShadow: "0px 4px 6px -2px rgba(16, 24, 40, 0.03), 0px 12px 16px -4px rgba(16, 24, 40, 0.08)",
                  width: 200,
                  zIndex: 1000,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "8px 20px" }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 550, color: "#101828" }}>Candidate Menu</h3>
                </div>
                <div style={{ height: 1, background: "#EAECF0", width: "100%" }} />
                <div style={{ padding: "8px 0" }}>
                  <button
                    style={{
                      width: "100%",
                      border: 0,
                      background: "transparent",
                      padding: "12px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 400,
                      color: "#344054",
                      textAlign: "left",
                    }}
                    onClick={() => {
                      if (onViewAnalysis) {
                        onViewAnalysis();
                      }
                      onCloseDropdown();
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#F9FAFB";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <img
                      src="/iconsV3/zap-dark.svg"
                      alt="View Analysis by Jia icon"
                      style={{ width: 16, height: 16, display: "block" }}
                    />
                    View Analysis by Jia
                  </button>
                  <button
                    style={{
                      width: "100%",
                      border: 0,
                      background: "transparent",
                      padding: "12px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 400,
                      color: "#344054",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#F9FAFB";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <img
                      src="/iconsV3/docs-dark.svg"
                      alt="View CV icon"
                      style={{ width: 16, height: 16, display: "block" }}
                    />
                    View CV
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Middle: Avatar + info */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          justifyContent: hasFit ? "flex-start" : "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
          <img
            src={card.avatar}
            alt=""
            style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
          />
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#414651",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
                display: "block",
              }}
              title={card.name}
            >
              {card.name}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "#717680",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
                display: "block",
              }}
              title={card.email}
            >
              {card.email}
            </span>
          </div>
        </div>
        {!hasFit && (
          <div style={{ position: "relative" }} ref={dropdownRef}>
            <button
              aria-label="More"
              onClick={onToggleDropdown}
              style={{
                border: 0,
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                marginLeft: 8,
              }}
            >
              <img src="/iconsV3/more-horizontal.svg" alt="" style={{ width: 20, height: 20, display: "block" }} />
            </button>
            {isDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 8,
                  background: "#fff",
                  border: "1px solid #EAECF0",
                  borderRadius: 12,
                  boxShadow: "0px 4px 6px -2px rgba(16, 24, 40, 0.03), 0px 12px 16px -4px rgba(16, 24, 40, 0.08)",
                  width: 200,
                  zIndex: 1000,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "16px 20px" }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 550, color: "#101828" }}>Candidate Menu</h3>
                </div>
                <div style={{ height: 1, background: "#EAECF0", width: "100%" }} />
                <div style={{ padding: "8px 0" }}>
                  <button
                    style={{
                      width: "100%",
                      border: 0,
                      background: "transparent",
                      padding: "12px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 400,
                      color: "#344054",
                      textAlign: "left",
                    }}
                    onClick={() => {
                      if (onViewAnalysis) {
                        onViewAnalysis();
                      }
                      onCloseDropdown();
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#F9FAFB";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <img
                      src="/iconsV3/zap-dark.svg"
                      alt="View Analysis by Jia icon"
                      style={{ width: 16, height: 16, display: "block" }}
                    />
                    View Analysis by Jia
                  </button>
                  <button
                    style={{
                      width: "100%",
                      border: 0,
                      background: "transparent",
                      padding: "12px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 400,
                      color: "#344054",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#F9FAFB";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <img
                      src="/iconsV3/docs-dark.svg"
                      alt="View CV icon"
                      style={{ width: 16, height: 16, display: "block" }}
                    />
                    View CV
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: time + endorsed/assessed */}
      <div style={{ borderTop: "1px solid #EAECF0", marginTop: 8, paddingTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#98A2B3" }}>{card.timeAgo}</span>
          
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1, justifyContent: "flex-end" }}>
            {/* Endorsed by */}
            {card.endorsedBy ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <img
                  src={card.endorsedByAvatar || "/maybe-fit-avatar.png"}
                  alt=""
                  style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                />
                <span 
                  style={{ 
                    fontSize: 12, 
                    color: "#717680",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    minWidth: 0
                  }}
                >
                  Endorsed by <span style={{ fontWeight: 550 }}>{card.endorsedBy}</span>
                </span>
              </div>
            ) : null}
            
            {/* Assessed by */}
            {card.assessedBy ? (
              <span 
                style={{ 
                  display: "inline-flex", 
                  alignItems: "center", 
                  gap: 6, 
                  fontSize: 12, 
                  color: "#98A2B3",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 0
                }}
              >
                <img src="/iconsV3/star-gradient- new.png" alt="" style={{ width: 17, height: 17, flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Assessed by {card.assessedBy}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

