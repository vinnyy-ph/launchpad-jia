"use client";

import styles from "./button.module.scss";
import { memo, useState } from "react";

interface ButtonProps {
  disabled?: boolean;
  icon?: string;
  iconPosition?: "left" | "right";
  label: string;
  variant?: "primary" | "secondary" | "tertiary";
  onClick: () => void;
}

export default memo(
  ({
    disabled = false,
    icon,
    iconPosition = "left",
    label,
    variant = "primary",
    onClick,
  }: ButtonProps) => {
    const [cooldown, setCooldown] = useState(false);
    const handleClick = () => {
      if (cooldown || disabled) return;

      onClick();
      setCooldown(true);
      setTimeout(() => {
        setCooldown(false);
      }, 300);
    };

    return (
      <button
        className={`${styles.button} ${disabled ? styles.disabled : styles[variant]}
        ${iconPosition == "right" ? styles.reverse : ""}`}
        disabled={cooldown || disabled}
        tabIndex={cooldown || disabled ? -1 : 0}
        onClick={handleClick}
      >
        {icon && <img alt="" src={icon} />}
        <span>{label}</span>
      </button>
    );
  },
);
