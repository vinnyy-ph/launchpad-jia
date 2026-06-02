"use client";

import styles from "./toggle.module.scss";
import { ChangeEvent, memo, useState } from "react";

interface ToggleProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ checked, disabled = false, onChange }: ToggleProps) {
  const [locked, setLocked] = useState(false);

  function handleOnChange(e: ChangeEvent<HTMLInputElement>) {
    if (locked || disabled) return;

    setLocked(true);
    onChange(e.target.checked);
    setTimeout(() => setLocked(false), 500);
  }

  return (
    <input
      className={styles.toggle}
      checked={checked}
      disabled={disabled || locked}
      type="checkbox"
      onChange={handleOnChange}
    />
  );
}

export default memo(Toggle);
