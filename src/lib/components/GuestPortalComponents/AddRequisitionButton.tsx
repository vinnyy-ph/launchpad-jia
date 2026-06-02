"use client";

import React from "react";

export type AddRequisitionButtonProps = {
  label?: string;
  startIcon?: React.ReactNode | null;
  onClick?: () => void;
};

const buttonStyles: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  borderRadius: "9999px",
  backgroundColor: "#101828",
  padding: "10px 16px",
  fontSize: "14px",
  fontWeight: 500,
  color: "#FFFFFF",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  border: "none",
  cursor: "pointer",
};

const defaultStartIcon = (
  <img
    src="/iconsV3/plus-requisition.svg"
    alt="Add requisition"
    style={{ width: "20px", height: "20px" }}
  />
);

export default function AddRequisitionButton({
  label = "Create a requisition",
  startIcon,
  onClick,
}: AddRequisitionButtonProps) {
  const iconNode = startIcon === undefined ? defaultStartIcon : startIcon;
  return (
    <button type="button" onClick={onClick} style={buttonStyles}>
      {iconNode && (
        <span style={{ display: "flex", alignItems: "center", fontSize: "16px", lineHeight: 1 }}>
          {iconNode}
        </span>
      )}
      <span>{label}</span>
    </button>
  );
}

