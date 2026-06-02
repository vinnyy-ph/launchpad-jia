"use client";

import styles from "./GradientCheckbox.module.scss";

interface GradientCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export default function GradientCheckbox({
  checked,
  onChange,
  label,
  disabled = false,
}: GradientCheckboxProps) {
  return (
    <label className={styles.container}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className={styles.input}
      />
      <div className={`${styles.checkbox} ${checked ? styles.checked : ""}`}>
        {checked && (
          <svg
            width="12"
            height="10"
            viewBox="0 0 12 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={styles.icon}
          >
            <path
              d="M10.8 1.60002L3.60002 8.80002L1.20002 6.40002" // Updated stroke to match checkmark
              stroke="white"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
}
