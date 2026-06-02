"use client";

import React, { createContext } from "react";
import styles from "./checkbox.module.scss";

export interface CheckboxGroupContextValue {
  name: string;
  value: string[];
  onValueChange: (value: string[]) => void;
}

export const CheckboxGroupContext = createContext<CheckboxGroupContextValue | undefined>(undefined);

export interface CheckboxGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  value: string[];
  onValueChange: (value: string[]) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export const CheckboxGroup = React.forwardRef<HTMLDivElement, CheckboxGroupProps>(
  ({ className, name = "checkbox-group", value, onValueChange, label, description, children, ...props }, ref) => {
    return (
      <CheckboxGroupContext.Provider value={{ name, value, onValueChange }}>
        <div ref={ref} className={`${styles.checkboxGroup} ${className || ""}`} role="group" {...props}>
          {(label || description) && (
            <div className={styles.groupContent}>
              {label && <span className={styles.groupLabel}>{label}</span>}
              {description && <p className={styles.groupDescription}>{description}</p>}
            </div>
          )}
          {children}
        </div>
      </CheckboxGroupContext.Provider>
    );
  }
);
CheckboxGroup.displayName = "CheckboxGroup";
