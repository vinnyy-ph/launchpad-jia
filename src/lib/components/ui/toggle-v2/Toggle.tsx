"use client";

import styles from "./toggle.module.scss";
import { ChangeEvent, memo, useState } from "react";

interface ToggleProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

export default memo(
  ({
    checked,
    defaultChecked = false,
    disabled = false,
    onChange,
  }: ToggleProps) => {
  const [cooldown, setCooldown] = useState(false);
    const [internalChecked, setInternalChecked] = useState(defaultChecked);
    const isControlled = typeof checked === "boolean";
    const resolvedChecked = isControlled ? checked : internalChecked;

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      if (cooldown || disabled) return;

      const nextChecked = event.target.checked;
      if (!isControlled) {
        setInternalChecked(nextChecked);
      }

      onChange?.(nextChecked);
      setCooldown(true);
      setTimeout(() => {
        setCooldown(false);
      }, 300);
    };

    return (
      <input
        checked={resolvedChecked}
        className={styles.toggle}
        disabled={cooldown || disabled}
        name="toggle"
        tabIndex={-1}
        type="checkbox"
        onChange={handleChange}
      />
    );
  },
);
