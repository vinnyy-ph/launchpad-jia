"use client";

import React, { createContext } from "react";
import styles from "./radio-group.module.scss";

export interface RadioGroupContextValue {
  name: string;
  value: string;
  onValueChange: (value: string) => void;
}

export const RadioGroupContext = createContext<RadioGroupContextValue | undefined>(undefined);

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, name = "radio-group", value, onValueChange, label, description, children, ...props }, ref) => {
    return (
      <RadioGroupContext.Provider value={{ name, value, onValueChange }}>
        <div ref={ref} className={`${styles.radioGroup} ${className || ""}`} role="radiogroup" {...props}>
          {(label || description) && (
            <div className={styles.groupContent}>
              {label && <span className={styles.groupLabel}>{label}</span>}
              {description && <p className={styles.groupDescription}>{description}</p>}
            </div>
          )}
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  }
);
RadioGroup.displayName = "RadioGroup";
