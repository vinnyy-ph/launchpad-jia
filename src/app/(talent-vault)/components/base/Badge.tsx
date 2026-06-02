"use client";

import styles from "@/app/(talent-vault)/styles/modules/badge.module.scss"

interface BadgeProps {
  content: string;
  variant?: "default" | "success" | "warning" | "error" | "neutral";
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
}

export function Badge({ content, variant = "default", prefixIcon, suffixIcon }: BadgeProps) {
  return (
    <span className={`${styles.tvBadge} ${styles[variant]}`}>
      {prefixIcon}
      <span>{content}</span>
      {suffixIcon}
    </span>
  )
}