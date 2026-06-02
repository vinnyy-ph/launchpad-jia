"use client";

import React from "react";

type RegenerateButtonProps = {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Reusable button component for regenerating CV analysis
 */
export function RegenerateButton({
  onClick,
  isLoading = false,
  disabled = false,
  className,
  style,
}: RegenerateButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      disabled={isDisabled}
      onClick={onClick}
      className={className}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "#FFFFFF",
        borderRadius: "60px",
        padding: "5px 10px",
        cursor: isDisabled ? "not-allowed" : "pointer",
        border: "1px solid #E9EAEB",
        opacity: isDisabled ? 0.5 : 1,
        ...style,
      }}
    >
      <i
        className={`la ${isLoading ? "la-circle-notch spin" : "la-sync-alt"}`}
        style={{ color: "#414651", fontSize: 16 }}
      ></i>
      <span>{isLoading ? "Regenerating..." : "Regenerate"}</span>
    </button>
  );
}

