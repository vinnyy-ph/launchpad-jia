"use client";

import { resolveRoleTypeBadge } from "./roleTypePresentation";

/**
 * RoleTypeBadge Component
 *
 * Renders a reusable badge for talent vault role types using tokens from the shared resolver.
 * Canonical roles display with exact mapped token values.
 * Unknown roles render neutral fallback styling.
 * Empty/null roles can optionally render a fallback or return null.
 *
 * API:
 * @prop roleType - Raw role type string (e.g., "Full-time", "Project-based")
 * @prop emptyFallback - Optional fallback text when roleType is empty/null (defaults to null)
 */

interface RoleTypeBadgeProps {
  roleType: string | null | undefined;
  emptyFallback?: string | null;
}

export default function RoleTypeBadge({
  roleType,
  emptyFallback = null,
}: RoleTypeBadgeProps) {
  // Resolve role type using shared contract
  const resolved = resolveRoleTypeBadge(roleType);

  // Handle empty/null cases
  if (!resolved) {
    if (emptyFallback) {
      return (
        <span
          style={{
            backgroundColor: "#F8F9FC",
            color: "#363F72",
            padding: "4px 12px",
            borderRadius: 6,
            fontWeight: 500,
            fontSize: 12,
            lineHeight: "18px",
            border: "1px solid #D5D9EB",
            display: "inline-block",
          }}
        >
          {emptyFallback}
        </span>
      );
    }
    return null;
  }

  // Render badge with resolved tokens
  return (
    <span
      style={{
        backgroundColor: resolved.tokens.backgroundColor,
        color: resolved.tokens.textColor,
        padding: "4px 12px",
        borderRadius: 6,
        fontWeight: 500,
        fontSize: 12,
        lineHeight: "18px",
        border: `1px solid ${resolved.tokens.borderColor}`,
        display: "inline-block",
      }}
    >
      {resolved.displayText}
    </span>
  );
}
