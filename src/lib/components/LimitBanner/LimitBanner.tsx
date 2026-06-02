"use client";

import React, { useState } from "react";

export type LimitBannerVariant = "warning" | "error";

export interface LimitBannerCTA {
  label: string;
  href: string;
}

export interface LimitBannerProps {
  /** The message to display in the banner */
  message: string;
  /** The visual variant of the banner */
  variant?: LimitBannerVariant;
  /** Optional call-to-action link */
  cta?: LimitBannerCTA;
  /** Whether the banner can be dismissed by the user */
  dismissible?: boolean;
  /** Additional CSS styles */
  style?: React.CSSProperties;
}

const BANNER_STYLES: Record<LimitBannerVariant, { bg: string; border: string; text: string }> = {
  warning: {
    bg: "#FEF3F2",
    border: "#FECDCA",
    text: "#B42318",
  },
  error: {
    bg: "#FEF3F2",
    border: "#F04438",
    text: "#B42318",
  },
};

/**
 * Generic limit banner component that displays contextual warnings
 * when plan limits are exceeded or nearing thresholds.
 * 
 * Features:
 * - Fixed at the very top of the viewport (z-index: 99999)
 * - Spans full width above all navigation and content
 * - Optional dismiss button (dismissible prop)
 * - Dismiss state resets on page reload
 */
export default function LimitBanner({
  message,
  variant = "warning",
  cta,
  dismissible = true,
  style,
}: LimitBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const colors = BANNER_STYLES[variant];

  // Don't render if dismissed
  if (isDismissed) {
    return null;
  }

  const bannerStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999, // Highest z-index to be above everything
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 500,
    backgroundColor: colors.bg,
    borderBottom: `1px solid ${colors.border}`,
    color: colors.text,
    width: "100%",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
    ...style,
  };

  const iconStyle: React.CSSProperties = {
    fontSize: 18,
    marginRight: 4,
  };

  const linkStyle: React.CSSProperties = {
    color: colors.text,
    fontWeight: 700,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    marginLeft: 8,
  };

  const closeButtonStyle: React.CSSProperties = {
    position: "absolute",
    right: 16,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
    color: colors.text,
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    opacity: 0.8,
    transition: "opacity 0.2s",
  };

  return (
    <div style={bannerStyle}>
      <i className="la la-exclamation-triangle" style={iconStyle} />
      <span>{message}</span>
      {cta && (
        <a href={cta.href} style={linkStyle}>
          {cta.label}
          <i className="la la-arrow-right" style={{ transform: "rotate(-45deg)", fontSize: 14 }} />
        </a>
      )}
      {dismissible && (
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          style={closeButtonStyle}
          aria-label="Dismiss banner"
          onMouseOver={(e) => { e.currentTarget.style.opacity = "1"; }}
          onMouseOut={(e) => { e.currentTarget.style.opacity = "0.8"; }}
        >
          <i className="la la-times" />
        </button>
      )}
    </div>
  );
}

