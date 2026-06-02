"use client";

import { CSSProperties, ReactNode, memo } from "react";
import styles from "./badge.module.scss";

const BADGE_RADIUS = {
  xs: "2px",
  sm: "4px",
  md: "6px",
  lg: "8px",
  xl: "12px",
  full: "999px",
} as const;

type BadgeVariant = "light" | "filled" | "outline";
type BadgeSize = "xs" | "sm" | "md" | "lg" | "xl";
type BadgeRadius = keyof typeof BADGE_RADIUS | number | string;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  backgroundColor?: string;
  borderColor?: string;
  children: ReactNode;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  radius?: BadgeRadius;
  size?: BadgeSize;
  textColor?: string;
  variant?: BadgeVariant;
}

function resolveRadius(radius: BadgeRadius): string {
  if (typeof radius === "number") {
    return `${radius}px`;
  }

  if (typeof radius === "string" && radius in BADGE_RADIUS) {
    return BADGE_RADIUS[radius as keyof typeof BADGE_RADIUS];
  }

  return String(radius);
}

function Badge({
  backgroundColor,
  borderColor,
  children,
  className,
  fullWidth = false,
  icon,
  iconPosition = "left",
  radius = "md",
  size = "md",
  style,
  textColor,
  variant = "light",
  ...props
}: BadgeProps) {
  const rootStyle = {
    "--badge-bg": backgroundColor,
    "--badge-border-color": borderColor ?? textColor ?? backgroundColor,
    "--badge-color": textColor,
    "--badge-radius": resolveRadius(radius),
    ...style,
  } as CSSProperties;

  return (
    <span
      className={[
        styles.badge,
        styles[variant],
        styles[`size-${size}`],
        fullWidth ? styles.fullWidth : "",
        className || "",
      ]
        .join(" ")
        .trim()}
      style={rootStyle}
      {...props}
    >
      {icon && iconPosition === "left" ? <span className={styles.section}>{icon}</span> : null}
      <span className={styles.label}>{children}</span>
      {icon && iconPosition === "right" ? <span className={styles.section}>{icon}</span> : null}
    </span>
  );
}

export default memo(Badge);
