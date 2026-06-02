"use client";

import React from "react";

interface JobPostUsageBarProps {
  label: string;
  used: number;
  max: number | null; // null = unlimited
  color: string;
  tooltipText?: string;
}

/**
 * Progress bar showing job post usage (e.g., 4/10) for a plan type.
 * Shows "Unlimited" indicator when max is null.
 * Bar turns red when usage is at 80% or more of limit.
 */
export default function JobPostUsageBar({
  label,
  used,
  max,
  color,
}: JobPostUsageBarProps) {
  const isUnlimited = max === null;

  // If unlimited, we don't show the bar at all
  if (isUnlimited) {
    return null;
  }

  // For unlimited plans, show a subtle filled bar indicating no constraints
  const percentage = isUnlimited ? 100 : (max > 0 ? Math.min((used / max) * 100, 100) : 0);

  // Warning when at 80% or more capacity
  const isWarning = !isUnlimited && max !== null && max > 0 && used >= max * 0.8;

  const gradient = isUnlimited
    ? "linear-gradient(90deg, rgba(159, 202, 237, 0.3) 0%, rgba(206, 182, 218, 0.3) 100%)"
    : isWarning
      ? "#F97066"
      : "linear-gradient(90deg, #fccec0 0%, #ebacc9 33%, #ceb6da 66%, #9fcaed 100%)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: "#414651",
          whiteSpace: "nowrap",
        }}
      >
        {label}:
      </span>
      {isUnlimited ? (
        <span style={{
          display: "inline-block",
          padding: "2px 10px",
          borderRadius: 999,
          backgroundColor: "#EFF8FF",
          color: "#175CD3",
          border: "1px solid #B2DDFF",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.02em"
        }}>
          Unlimited
        </span>
      ) : (
        <>
          <div
            style={{
              flex: 1,
              height: 8,
              backgroundColor: "#E9EAEB",
              borderRadius: 999,
              overflow: "hidden",
              minWidth: 100,
            }}
          >
            <div
              style={{
                width: `${percentage}%`,
                height: "100%",
                background: gradient,
                borderRadius: 999,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#181D27",
              whiteSpace: "nowrap",
              minWidth: 40,
              textAlign: "right",
            }}
          >
            {`${used}/${max}`}
          </span>
        </>
      )}
    </div>
  );
}

