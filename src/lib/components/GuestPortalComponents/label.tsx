import React from "react";

export interface LabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  textColor?: string;
  bgColor?: string;
  strokeColor?: string;
}

export function Label({ textColor, bgColor, strokeColor, style, children, ...rest }: LabelProps) {
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    background: bgColor,
    color: textColor,
    border: strokeColor ? `1px solid ${strokeColor}` : undefined,
    ...style,
  };

  return (
    <span style={baseStyle} {...rest}>
      {children}
    </span>
  );
}

export default Label;

