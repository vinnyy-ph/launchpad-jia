"use client";

import styles from "./field.module.scss";
import { TooltipV2 } from "@/lib/components/ui/";
import { memo, useEffect } from "react";

interface FieldProps extends InitProps {
  disabled?: boolean;
  errordata?: Record<string, string>;
  formdata: Record<string, string>;
  label: string;
  placeholder?: string;
  tooltip?: { message: string; width: number };
  handleInit?: ({ id, isOptional }: InitProps) => void;
  handleOnChange: ({ value, id }: OnChangeProps) => void;
}

interface InitProps {
  id: string;
  isOptional?: boolean;
}

interface OnChangeProps {
  id: string;
  value: string;
}

export default memo(
  ({
    disabled = false,
    errordata,
    formdata,
    id,
    isOptional = false,
    label,
    placeholder,
    tooltip,
    handleInit,
    handleOnChange,
  }: FieldProps) => {
    useEffect(() => {
      if (handleInit) {
        handleInit({ id, isOptional });
      }
    }, []);

    return (
      <div className={styles.field}>
        <span className={styles.label}>
          {label}
          {!isOptional && <span className={styles.required}>*</span>}
          {tooltip && (
            <TooltipV2 message={tooltip.message} width={tooltip.width} />
          )}
        </span>

        <div className={styles.input}>
          <input
            className={`${errordata && errordata[id] ? styles.error : ""}
            ${disabled ? styles.disabled : ""}`}
            disabled={disabled}
            id={id}
            placeholder={placeholder || ""}
            tabIndex={disabled ? -1 : 0}
            value={formdata?.[id] || ""}
            onBlur={(event) => {
              if (placeholder) {
                event.target.placeholder = placeholder;
              }
            }}
            onChange={(event) => {
              handleOnChange({ value: event.target.value, id });
            }}
            onFocus={(event) => {
              if (placeholder) {
                event.target.placeholder = "";
              }
            }}
          />

          {errordata && errordata[id] && (
            <img alt="" src="/icons/alert-circle.svg" />
          )}
        </div>

        <span
          className={`${styles.errorMessage}
          ${errordata && errordata[id] ? styles.visible : ""}`}
        >
          {errordata && errordata[id]}
        </span>
      </div>
    );
  },
);
