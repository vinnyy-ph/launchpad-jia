"use client";

import styles from "./button.module.scss";
import { memo, useState } from "react";

export interface ButtonProps {
  disabled?: boolean;
  id?: string;
  icon?: string;
  iconJsx?: React.ReactNode;
  label: string;
  size?: "default" | "large";
  variant?: "primary" | "secondary" | "tertiary" | "secondary-filled-success" | "tertiary-outline" | "tertiary-outline-filled" | "tertiary-filled-destructive";
  svgAsset?: any;
  style?: React.CSSProperties;
  pill?: boolean;
  iconPosition?: "left" | "right";
  type?: "button" | "submit" | "reset";
  title?: string;
  iconStyle?: React.CSSProperties;
  onClick: () => void;
  className?: string;
}

function Button({
  disabled = false,
  id,
  icon,
  iconJsx,
  label,
  size = "default",
  variant = "primary",
  svgAsset,
  style = {},
  pill = false,
  iconStyle = {},
  iconPosition = "left",
  type = "button",
  title,
  onClick,
  className,
}: ButtonProps) {
  const [locked, setLocked] = useState(false);

  function handleClick() {
    if (disabled || locked) return;

    setLocked(true);
    onClick();
    setTimeout(() => setLocked(false), 500);
  }

  return (
    <button
      type={type}
      id={id}
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${pill ? styles.pill : ""} ${className}
      ${disabled ? styles.disabled : ""}`}
      disabled={disabled || locked}
      tabIndex={disabled || locked ? -1 : 0}
      onClick={handleClick}
      style={style}
      title={title}
    >
      {icon && iconPosition === "left" && <img alt="" src={icon} style={iconStyle} />}
      {iconJsx && iconPosition === "left" && iconJsx}
      {svgAsset && svgAsset}
      {label && <span>{label}</span>}
      {icon && iconPosition === "right" && <img alt="" src={icon} style={iconStyle} />}
      {iconJsx && iconPosition === "right" && iconJsx}
    </button>
  );
}

export default memo(Button);
