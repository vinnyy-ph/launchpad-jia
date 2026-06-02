"use client";

import React, { memo } from "react";
import styles from "./stack.module.scss";

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: React.CSSProperties["alignItems"];
  gap?: number | string;
  justify?: React.CSSProperties["justifyContent"];
}

function resolveSpacing(gap: StackProps["gap"]): string {
  if (typeof gap === "number") return `${gap}px`;
  if (typeof gap === "string") return gap;
  return "16px";
}

function Stack({
  align = "stretch",
  gap = "16px",
  justify = "flex-start",
  className,
  style,
  children,
  ...props
}: StackProps) {
  const rootStyle: React.CSSProperties = {
    alignItems: align,
    gap: resolveSpacing(gap),
    justifyContent: justify,
    ...style,
  };

  return (
    <div className={`${styles.root} ${className || ""}`.trim()} style={rootStyle} {...props}>
      {children}
    </div>
  );
}

export default memo(Stack);
