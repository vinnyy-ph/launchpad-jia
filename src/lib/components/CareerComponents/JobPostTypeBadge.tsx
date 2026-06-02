"use client";

import React from "react";
import { Tooltip } from "react-tooltip";

type JobPostType = "premium" | "credit-based" | null;

interface JobPostTypeBadgeProps {
  type: JobPostType;
  showTooltip?: boolean;
  size?: "default" | "compact";
}

const BADGE_CONFIG = {
  premium: {
    label: "Premium",
    bgColor: "#FDF2FA",
    strokeColor: "#FCCEEE",
    textColor: "#C11574",
    tooltipText: "Premium job posts have unlimited interviews and does not consume credits.",
  },
  "credit-based": {
    label: "Credit-based",
    bgColor: "#F4F3FF",
    strokeColor: "#D9D6FE",
    textColor: "#5925DC",
    tooltipText: "Credit-based job posts consume 10 credits per AI interview.",
  },
  null: {
    label: "No Plan",
    bgColor: "#F5F5F5",
    strokeColor: "#E9EAEB",
    textColor: "#414651",
    tooltipText: "This career has no assigned plan type.",
  },
};

/**
 * Badge component displaying the job post type with optional tooltip.
 * - Premium: Blue/purple badge (unlimited AI interviews)
 * - Credit-based: Orange/coral badge (10 credits per interview)
 * - No Plan: Gray badge (legacy careers)
 */
export default function JobPostTypeBadge({
  type,
  showTooltip = true,
  size = "default",
}: JobPostTypeBadgeProps) {
   const config = BADGE_CONFIG[type ?? "null"];
  // Use useId for stable ID generation across renders
  const uniqueId = React.useId();
  const tooltipId = `job-post-type-tooltip-${type ?? "null"}-${uniqueId}`;
  
  const padding = size === "compact" ? "0px 8px" : "4px 12px";
  const borderRadius = size === "compact" ? "60px" : "16px";
  const fontWeight = size === "compact" ? 700 : 500;

  return (
    <>
      <span
        data-tooltip-id={showTooltip ? tooltipId : undefined}
        data-tooltip-content={showTooltip ? config.tooltipText : undefined}
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding,
          borderRadius,
          backgroundColor: config.bgColor,
          border: `1px solid ${config.strokeColor}`,
          color: config.textColor,
          fontSize: "12px",
          fontWeight,
          whiteSpace: "nowrap",
          cursor: showTooltip ? "help" : "default",
        }}
      >
        {config.label}
      </span>
      {showTooltip && (
        <Tooltip
          id={tooltipId}
          place="top"
          style={{
            backgroundColor: "#1D2939",
            color: "#FFFFFF",
            fontWeight: 500,
            padding: "6px 10px",
            borderRadius: "8px",
            maxWidth: "250px",
            whiteSpace: "normal",
            lineHeight: 1.45,
            wordBreak: "break-word",
            zIndex: 9999,
          }}
          className="job-post-type-tooltip"
        />
      )}
    </>
  );
}

