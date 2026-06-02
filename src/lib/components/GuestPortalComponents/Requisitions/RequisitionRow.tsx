"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Label } from "../label";
import { RequisitionItem } from "./types";
import RequisitionActionsDropdown from "./RequisitionActionsDropdown";
import Tooltip from "./tooltip";

/**
 * Format a date string as relative time (e.g., "Just now", "2 hours ago", "Nov 28, 2025")
 */
function formatRelativeDate(dateString: string): string {
  // Handle legacy "Just now" strings
  if (dateString === "Just now") return dateString;
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString; // Return as-is if invalid
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  
  // For older dates, show formatted date
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const statusStyles: Record<string, { bgColor: string; textColor: string; strokeColor: string }> = {
  "Requires More Info": {
    bgColor: "#FFFAEB",
    textColor: "#B54708",
    strokeColor: "#FEDF89",
  },
  "In Review": {
    bgColor: "#F8F9FC",
    textColor: "#363F72",
    strokeColor: "#D5D9EB",
  },
  Active: {
    bgColor: "#ECFDF3",
    textColor: "#027948",
    strokeColor: "#A6F4C5",
  },
  Completed: {
    bgColor: "#EEFDF3",
    textColor: "#027948",
    strokeColor: "#B7F3CA",
  },
  "On Hold": {
    bgColor: "#F5F5F5",
    textColor: "#344054",
    strokeColor: "#E9EAEB",
  },
  Cancelled: {
    bgColor: "#FEF3F2",
    textColor: "#B42318",
    strokeColor: "#FECDCA",
  },
  "Request to Cancel": {
    bgColor: "rgba(255, 241, 243, 1)",
    textColor: "rgba(192, 16, 72, 1)",
    strokeColor: "rgba(254, 204, 214, 1)",
  },
};

export default function RequisitionRow({ 
  item, 
  openActionsId, 
  setOpenActionsId,
  onCancelRequest,
  isUpdatingStatus = false,
  isLastRow = false
}: { 
  item: RequisitionItem;
  openActionsId: string | null;
  setOpenActionsId: React.Dispatch<React.SetStateAction<string | null>>;
  onCancelRequest: (requisitionId: string, reason: string) => Promise<void>;
  isUpdatingStatus?: boolean;
  isLastRow?: boolean;
}) {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId");
  
  // Helper to build URL with orgId
  const buildUrl = (path: string, additionalParams?: string) => {
    const params = new URLSearchParams();
    if (orgId) params.set("orgId", orgId);
    if (additionalParams) {
      const additional = new URLSearchParams(additionalParams);
      additional.forEach((value, key) => params.set(key, value));
    }
    const paramString = params.toString();
    return paramString ? `${path}?${paramString}` : path;
  };
  
  const style = statusStyles[item.status] || statusStyles["Active"];
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [isHoveringTitle, setIsHoveringTitle] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Show tooltip on click if it has a message
  const hasMoreInfoContent = item.status === "Requires More Info" && (item.moreInfoReason || item.warningMessage);
  const hasCancelContent = item.status === "Request to Cancel" && item.cancelReason;
  const showTooltip = isTooltipOpen && (hasMoreInfoContent || hasCancelContent);
  
  // Determine tooltip content and whether it's rich text
  const getTooltipContent = () => {
    if (item.status === "Requires More Info") {
      return {
        title: "More Info Needed:",
        content: item.moreInfoReason || item.warningMessage || "",
        isRichText: !!item.moreInfoReason
      };
    } else if (item.status === "Request to Cancel") {
      let cancelContent = item.cancelReason || "";
      
      // Format "Others (please specify reason*) - value" to "Others: value"
      if (cancelContent.includes("Others (please specify reason*)")) {
        const customValue = cancelContent.split(" - ")[1] || "";
        cancelContent = customValue ? `Others: ${customValue}` : cancelContent;
      }
      
      return {
        title: "Reason:",
        content: cancelContent,
        isRichText: false
      };
    }
    return { title: "", content: "", isRichText: false };
  };
  
  const tooltipContent = getTooltipContent();
  const isActionsOpen = openActionsId === item.id;

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsTooltipOpen(false);
      }
    };

    if (isTooltipOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTooltipOpen]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1.5fr 1.5fr 1.5fr 0.5fr",
        alignItems: "center",
        padding: "16px 24px",
        borderBottom: isLastRow ? "none" : "1px solid #EAECF0",
        gap: 16,
        background: "#fff",
        borderBottomLeftRadius: isLastRow ? 12 : 0,
        borderBottomRightRadius: isLastRow ? 12 : 0,
      }}
      onMouseEnter={() => {
        setIsHoveringTitle(true);
      }}
      onMouseLeave={() => {
        setIsHoveringTitle(false);
      }}
    >
      {/* Position Name */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link
          href={buildUrl(`/guest-portal/requisitions/edit/${item.id}`, "mode=view")}
          style={{
            padding: 0,
            margin: 0,
            border: "none",
            background: "transparent",
            color: isHoveringTitle ? "#175CD3" : "#101828",
            fontWeight: 600,
            fontSize: 14,
            textAlign: "left",
            cursor: "pointer",
            textDecoration: isHoveringTitle ? "underline" : "none",
          }}
        >
          {item.positionName}
        </Link>
        {item.hasWarning && (
          <img
            src="/iconsV3/warning-badge.svg"
            alt="Warning"
            style={{ width: 16, height: 16 }}
          />
        )}
      </div>

      {/* Reference No */}
      <div style={{ color: "#475467", fontSize: 14 }}>{item.referenceNo}</div>

      {/* Date Submitted */}
      <div style={{ color: "#475467", fontSize: 14 }}>{formatRelativeDate(item.dateSubmitted)}</div>

      {/* Status */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          ref={tooltipRef}
          style={{ position: "relative", display: "inline-flex" }}
          onClick={() => {
            if (hasMoreInfoContent || hasCancelContent) {
              setIsTooltipOpen(!isTooltipOpen);
            }
          }}
        >
          <Label
            bgColor={style.bgColor}
            textColor={style.textColor}
            strokeColor={style.strokeColor}
            style={{ cursor: (hasMoreInfoContent || hasCancelContent) ? "pointer" : "default" }}
          >
            {item.status}
            {item.status === "Requires More Info" && (
              <img
                src="/iconsV3/warning-icon.svg"
                alt=""
                style={{ width: 12, height: 12, marginLeft: 2 }}
              />
            )}
            {item.status === "Completed" && (
              <img
                src="/iconsV3/check-circle-outline.svg"
                alt=""
                style={{ width: 12, height: 12, marginLeft: 2 }}
              />
            )}
            {item.status === "Request to Cancel" && (
              <img
                src="/iconsV3/helper-red.svg"
                alt=""
                style={{ width: 12, height: 12, marginLeft: 2 }}
              />
            )}
          </Label>

          {/* Tooltip */}
          {showTooltip && (
            <Tooltip
              title={tooltipContent.title}
              content={tooltipContent.content}
              isRichText={tooltipContent.isRichText}
            />
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
        <Link 
          href={buildUrl(`/guest-portal/requisitions/edit/${item.id}`, "mode=view")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
            textDecoration: "none",
          }}
        >
          <img src="/iconsV3/eye.svg" alt="View" style={{ width: 20, height: 20 }} />
        </Link>
        <RequisitionActionsDropdown
          status={item.status}
          positionName={item.positionName}
          requisitionId={item.id}
          isOpen={isActionsOpen}
          onToggle={() => {
            setOpenActionsId((current) => (current === item.id ? null : item.id));
          }}
          onClose={() => {
            setOpenActionsId((current) => (current === item.id ? null : current));
          }}
          onCancelRequest={onCancelRequest}
          isUpdatingStatus={isUpdatingStatus}
        />
      </div>
    </div>
  );
}

