"use client";

import React from "react";

interface AdminSeatUsageSummaryProps {
  used: number;
  max: number | null;
}

/**
 * Progress bar showing admin seat usage (e.g., 5/5) for the organization.
 * Similar styling to JobPostUsageBar.
 */
export default function AdminSeatUsageSummary({
  used,
  max,
}: AdminSeatUsageSummaryProps) {
  // null max means unlimited, which we don't want to show anymore
  const isUnlimited = max === null;

  // Don't render if no limit is set (unlimited) or if max <= 0 (invalid)
  if (isUnlimited || max <= 0) {
    return null;
  }

  const percentage = isUnlimited ? 100 : Math.min((used / max!) * 100, 100);
  // Warning when at 80% or more capacity
  const isWarning = !isUnlimited && used >= max! * 0.8;

  // Use a softer gradient/color for unlimited or standard usage
  const barColor = isUnlimited
    ? "linear-gradient(90deg, rgba(159, 202, 237, 0.4) 0%, rgba(206, 182, 218, 0.4) 100%)"
    : isWarning
      ? "#F97066"
      : "linear-gradient(90deg, #fccec0 0%, #ebacc9 33%, #ceb6da 66%, #9fcaed 100%)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
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
        Maximum admin seats:
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
              height: 8,
              backgroundColor: "#E9EAEB",
              borderRadius: 999,
              overflow: "hidden",
              minWidth: 120,
              width: 120,
            }}
          >
            <div
              style={{
                width: `${percentage}%`,
                height: "100%",
                background: barColor,
                borderRadius: 999,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: isWarning ? "#B42318" : "#181D27",
              whiteSpace: "nowrap",
            }}
          >
            {used}/{max}
          </span>
        </>
      )}
    </div>
  );
}

