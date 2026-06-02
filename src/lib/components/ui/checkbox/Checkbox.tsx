"use client";

import React from "react";
import { CheckboxGroup, CheckboxGroupContext } from "./CheckboxGroup";
import styles from "./checkbox.module.scss";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  value?: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, value, label, description, onChange, onCheckedChange, checked, name, id, ...props },
  ref,
) {
  const context = React.useContext(CheckboxGroupContext);
  const fallbackId = React.useId();
  const isGrouped = Boolean(context);

  if (isGrouped && !value) {
    throw new Error("Checkbox inside Checkbox.Group requires a value");
  }

  const resolvedValue = value ?? "on";
  const isChecked = isGrouped ? context.value.includes(resolvedValue) : checked;
  const inputId = id || (isGrouped ? `${context.name}-${resolvedValue}` : `checkbox-${fallbackId}`);
  const containerClassName = [
    styles.container,
    description ? styles.withDescription : "",
    className || "",
  ]
    .join(" ")
    .trim();

  return (
    <label className={containerClassName} htmlFor={inputId}>
      <input
        type="checkbox"
        id={inputId}
        ref={ref}
        name={isGrouped ? context.name : name}
        value={resolvedValue}
        checked={isChecked}
        disabled={props.disabled}
        onChange={(event) => {
          if (props.disabled) return;

          onChange?.(event);
          onCheckedChange?.(event.target.checked);

          if (isGrouped) {
            const next = event.target.checked
              ? [...context.value, resolvedValue]
              : context.value.filter((item) => item !== resolvedValue);
            context.onValueChange(next);
          }
        }}
        className={styles.input}
        {...props}
      />
      <div className={`${styles.checkbox} ${isChecked ? styles.checked : ""}`}>
        {isChecked && (
          <svg
            width="12"
            height="10"
            viewBox="0 0 12 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={styles.icon}
          >
            <path
              d="M10.8 1.60002L3.60002 8.80002L1.20002 6.40002"
              stroke="white"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      {description ? (
        <div className={styles.content}>
          {label &&
            (typeof label === "string" ? <span className={styles.label}>{label}</span> : label)}
          <p className={styles.description}>{description}</p>
        </div>
      ) : (
        label &&
        (typeof label === "string" ? <span className={styles.label}>{label}</span> : label)
      )}
    </label>
  );
});

type CheckboxComponent = typeof Checkbox & {
  Group: typeof CheckboxGroup;
};

export default Object.assign(React.memo(Checkbox), {
  Group: CheckboxGroup,
}) as CheckboxComponent;
