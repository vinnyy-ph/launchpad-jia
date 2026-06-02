"use client";

import { useState } from "react";

interface CreditDeferredBadgeProps {
  /** Optional custom tooltip text */
  tooltipText?: string;
}

const SALES_EMAIL = "sales@hellojia.ai";
const SALES_SUBJECT = "Request for More Credits";

/**
 * Badge component displayed on applicant cards when a candidate's
 * auto-promotion to AI Interview was deferred due to low credit balance.
 */
export default function CreditDeferredBadge({
  tooltipText = "This candidate is eligible to proceed to AI Interview but was deferred due to insufficient credit balance.",
}: CreditDeferredBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const badgeStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 999,
    backgroundColor: "#FFFAEB",
    border: "1px solid #FEDF89",
    fontSize: 11,
    fontWeight: 600,
    color: "#B54708",
    cursor: "pointer",
  };

  const tooltipStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "calc(100% + 8px)",
    left: "50%",
    transform: "translateX(-50%)",
    width: 240,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#181D27",
    color: "#fff",
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.5,
    zIndex: 1000,
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
    textAlign: "left",
  };

  const arrowStyle: React.CSSProperties = {
    position: "absolute",
    bottom: -6,
    left: "50%",
    transform: "translateX(-50%)",
    width: 0,
    height: 0,
    borderLeft: "6px solid transparent",
    borderRight: "6px solid transparent",
    borderTop: "6px solid #181D27",
  };

  const linkStyle: React.CSSProperties = {
    color: "#93B4FF",
    fontWeight: 600,
    textDecoration: "none",
    display: "block",
    marginTop: 8,
  };

  const mailtoLink = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(SALES_SUBJECT)}`;

  return (
    <div
      style={badgeStyle}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <i className="la la-exclamation-triangle" style={{ fontSize: 12 }} />
      <span>Pending Credits</span>

      {showTooltip && (
        <div style={tooltipStyle}>
          {tooltipText}
          <a href={mailtoLink} style={linkStyle} onClick={(e) => e.stopPropagation()}>
            Contact sales to purchase more credits →
          </a>
          <div style={arrowStyle} />
        </div>
      )}
    </div>
  );
}

