import React from "react";

interface SkillEndorsementTooltipProps {
  count: number;
}

export function SkillEndorsementTooltip({ count }: SkillEndorsementTooltipProps) {
  if (count <= 0) return null;

  const label = `${count} endorsement${count > 1 ? "s" : ""}`;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 10px)",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: "#101828",
        color: "#FFFFFF",
        padding: "6px 12px",
        borderRadius: "9999px",
        fontSize: "12px",
        fontWeight: 500,
        whiteSpace: "nowrap",
        boxShadow: "0 8px 16px rgba(15, 23, 42, 0.35)",
        zIndex: 20,
      }}
    >
      {label}
      <div
        style={{
          position: "absolute",
          top: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: "6px solid #101828",
        }}
      />
    </div>
  );
}
