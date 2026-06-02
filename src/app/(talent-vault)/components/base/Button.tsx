"use client";

import styles from "../../styles/modules/button.module.scss";
import { memo, useState } from "react";

interface ButtonProps {
  disabled?: boolean;
  id?: string;
  size?: "default" | "large";
  variant?: "primary" | "secondary" | "tertiary" | "secondary-filled-success" | "tertiary-outline" | "tertiary-outline-filled" | "tertiary-filled-destructive";
  style?: React.CSSProperties;
  type?: "button" | "submit" | "reset";
  title?: string;
  onClick?: () => void;
  children: React.ReactNode;
  href?: string;
  target?: "_blank" | "_self" | "_parent" | "_top";
  width?: "full" | "fit";
  pill?: boolean;
}

function Button({
  disabled = false,
  id,
  size = "default",
  variant = "primary",
  style = {},
  type = "button",
  title,
  onClick,
  children,
  href,
  target,
  width = "fit",
  pill = true,
}: ButtonProps) {
  const [locked, setLocked] = useState(false);

  function handleClick() {
    if (disabled || locked) return;

    setLocked(true);
    onClick?.();
    setTimeout(() => setLocked(false), 500);
  }

  const className = `${styles.button} ${styles[variant]} ${styles[size]} ${pill && styles.pill}
    ${disabled ? styles.disabled : ""} ${width === "full" ? styles.fullWidth : ""}`;

  if (href) {
    return (
      <a
        id={id}
        className={className}
        href={disabled ? undefined : href}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        style={style}
        title={title}
        aria-disabled={disabled}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      id={id}
      className={className}
      disabled={disabled || locked}
      tabIndex={disabled || locked ? -1 : 0}
      onClick={handleClick}
      style={style}
      title={title}
    >
      {children}
    </button>
  );
}

export default memo(Button);
