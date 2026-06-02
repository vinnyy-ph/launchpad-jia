"use client";

import React, { createContext, useContext } from "react";
import styles from "./radio-group.module.scss";

interface RadioGroupContextValue {
  name: string;
  value: string;
  onChange: (value: string) => void;
}

const RadioGroupContext = createContext<RadioGroupContextValue | undefined>(undefined);

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
}

export const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, name = "radio-group", value, onValueChange, children, ...props }, ref) => {
    return (
      <RadioGroupContext.Provider value={{ name, value, onChange: onValueChange }}>
        <div ref={ref} className={`${styles.radioGroup} ${className || ""}`} role="radiogroup" {...props}>
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  }
);
RadioGroup.displayName = "RadioGroup";

export interface RadioGroupItemProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
  value: string;
  id?: string;
}

export const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, id, children, ...props }, ref) => {
    const context = useContext(RadioGroupContext);
    if (!context) {
      throw new Error("RadioGroupItem must be used within a RadioGroup");
    }

    const { name, value: groupValue, onChange } = context;
    const isChecked = groupValue === value;
    const inputId = id || `${name}-${value}`;

    return (
      <label htmlFor={inputId} className={`${styles.radioItem} ${className || ""}`}>
        <input
          type="radio"
          id={inputId}
          ref={ref}
          name={name}
          value={value}
          checked={isChecked}
          onChange={() => onChange(value)}
          className={styles.radioInput}
          {...props}
        />
        <span className={styles.radioIndicator} aria-hidden="true" />
        {children && <div className={styles.radioContent}>{children}</div>}
      </label>
    );
  }
);
RadioGroupItem.displayName = "RadioGroupItem";
