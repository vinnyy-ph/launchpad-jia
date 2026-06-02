"use client";

import React from "react";
import { RadioGroup, RadioGroupContext } from "./RadioGroup";
import styles from "./radio-group.module.scss";

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  value?: string;
  id?: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
}

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { className, value, id, label, description, onChange, checked, name, ...props },
  ref,
) {
  const context = React.useContext(RadioGroupContext);
  const fallbackId = React.useId();
  const resolvedValue = value ?? "on";
  const isGrouped = Boolean(context);
  const isChecked = isGrouped ? context.value === resolvedValue : checked;
  const inputId = id || (isGrouped ? `${context.name}-${resolvedValue}` : `radio-${fallbackId}`);

  return (
    <label htmlFor={inputId} className={`${styles.radioItem} ${className || ""}`}>
      <input
        type="radio"
        id={inputId}
        ref={ref}
        name={isGrouped ? context.name : name}
        value={resolvedValue}
        checked={isChecked}
        onChange={(event) => {
          if (props.disabled) return;
          onChange?.(event);
          if (isGrouped) {
            context.onValueChange(resolvedValue);
          }
        }}
        className={styles.radioInput}
        {...props}
      />
      <span className={styles.radioIndicator} aria-hidden="true" />
      {(label || description) && (
        <div className={styles.radioContent}>
          {label && <span className={styles.radioLabel}>{label}</span>}
          {description && <p className={styles.radioDescription}>{description}</p>}
        </div>
      )}
    </label>
  );
});

type RadioComponent = typeof Radio & {
  Group: typeof RadioGroup;
};

export default Object.assign(React.memo(Radio), {
  Group: RadioGroup,
}) as RadioComponent;
