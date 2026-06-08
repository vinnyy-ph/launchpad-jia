"use client";

import type { CSSProperties, ReactNode } from "react";
import styles from "./manual-profile.module.scss";

interface LabeledFieldProps {
  label?: ReactNode;
  /** Associate the <label> with the control id (a11y + getByLabelText). */
  htmlFor?: string;
  withAsterisk?: boolean;
  error?: ReactNode;
  className?: string;
  /** Forwarded to the root so the wrapper works as a DS <Group grow> child. */
  style?: CSSProperties;
  children: ReactNode;
}

// Shared "labeled field" layout for the controls DS Field/Select can't render
// natively: control groups (one label over Month + Year) and custom controls
// (url combo, rich-text). Emits the same label block + 6px gap as the DS
// components, so any two controls in a row align by construction.
export default function LabeledField({
  label,
  htmlFor,
  withAsterisk = false,
  error,
  className,
  style,
  children,
}: LabeledFieldProps) {
  return (
    <div
      className={`${styles.labeledField}${className ? ` ${className}` : ""}`}
      style={style}
    >
      {label != null && (
        <label className={styles.labeledFieldLabel} htmlFor={htmlFor}>
          {label}
          {withAsterisk && <span className={styles.labeledFieldAsterisk}> *</span>}
        </label>
      )}
      {children}
      {error != null && (
        // Mirrors DS Field's own error wiring (`${inputId}-error`): consumers
        // point their control's aria-describedby at this id.
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          className={styles.labeledFieldError}
        >
          {error}
        </p>
      )}
    </div>
  );
}
