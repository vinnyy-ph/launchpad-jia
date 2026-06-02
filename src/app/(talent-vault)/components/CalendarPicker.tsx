"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/app/(talent-vault)/styles/modules/calendar-picker.module.scss";

type BaseProps = {
  placeholder?: string;
  disabled?: boolean;
};

type FullDateProps = BaseProps & {
  mode: "full-date";
  value: Date | null;
  onChange: (value: Date | null) => void;
};

type MonthProps = BaseProps & {
  mode: "month";
  value: string | null;
  onChange: (value: string) => void;
};

type YearProps = BaseProps & {
  mode: "year";
  value: number | null;
  onChange: (value: number) => void;
  minYear?: number;
  maxYear?: number;
};

type CalendarPickerProps = FullDateProps | MonthProps | YearProps;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatFullDate(value: Date | null): string {
  if (!value || Number.isNaN(value.getTime())) return "";

  const month = value.toLocaleString("en-US", { month: "long" });
  const day = value.getDate();
  const year = value.getFullYear();
  return `${month} ${day}, ${year}`;
}

function toDateInputValue(value: Date | null): string {
  if (!value || Number.isNaN(value.getTime())) return "";

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CalendarPicker(props: CalendarPickerProps) {
  const { disabled = false, placeholder } = props;
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fullDateInputRef = useRef<HTMLInputElement>(null);
  const selectedOptionRef = useRef<HTMLButtonElement>(null);
  const minYear = props.mode === "year" ? props.minYear : undefined;
  const maxYear = props.mode === "year" ? props.maxYear : undefined;

  const yearRange = useMemo(() => {
    if (props.mode !== "year") return [] as number[];

    const currentYear = new Date().getFullYear();
    const min = props.minYear ?? currentYear - 70;
    const max = props.maxYear ?? currentYear + 10;

    return Array.from({ length: max - min + 1 }, (_, i) => min + i).reverse();
  }, [props.mode, minYear, maxYear]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (props.mode !== "month" && props.mode !== "year") return;

    selectedOptionRef.current?.scrollIntoView({
      block: "nearest",
    });
  }, [isOpen, props.mode, props.value]);

  const displayValue =
    props.mode === "full-date"
      ? formatFullDate(props.value)
      : props.value
        ? String(props.value)
        : "";

  return (
    <div ref={rootRef} className={styles.root}>
      {props.mode === "full-date" ? (
        <div
          className={styles.fullDateTrigger}
          onClick={() => {
            if (disabled) return;
            const input = fullDateInputRef.current as
              | (HTMLInputElement & { showPicker?: () => void })
              | null;

            if (input?.showPicker) {
              input.showPicker();
            }
          }}
        >
          <span className={`${styles.value} ${displayValue ? styles.selected : styles.placeholder}`}>
            {displayValue || placeholder || "Select"}
          </span>
          <img src="/iconsV2/calendar.svg" alt="Calendar icon" className={styles.icon} />
          <input
            ref={fullDateInputRef}
            type="date"
            className={styles.nativeDateInput}
            value={toDateInputValue(props.value)}
            onChange={(event) => {
              const next = event.target.value ? new Date(`${event.target.value}T00:00:00`) : null;
              props.onChange(next);
            }}
            disabled={disabled}
          />
        </div>
      ) : (
      <button
        type="button"
        className={styles.trigger}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
      >
        <span className={`${styles.value} ${displayValue ? styles.selected : styles.placeholder}`}>
          {displayValue || placeholder || "Select"}
        </span>
        <img src="/iconsV2/calendar.svg" alt="Calendar icon" className={styles.icon} />
      </button>
      )}

      {props.mode !== "full-date" && isOpen && (
        <div className={styles.menu}>
          {props.mode === "month" && (
            <div className={styles.options}>
              {MONTHS.map((month) => (
                <button
                  type="button"
                  key={month}
                  ref={props.value === month ? selectedOptionRef : null}
                  className={`${styles.option} ${props.value === month ? styles.optionSelected : ""}`}
                  onClick={() => {
                    props.onChange(month);
                    setIsOpen(false);
                  }}
                >
                  {month}
                </button>
              ))}
            </div>
          )}

          {props.mode === "year" && (
            <div className={styles.options}>
              {yearRange.map((year) => (
                <button
                  type="button"
                  key={year}
                  ref={props.value === year ? selectedOptionRef : null}
                  className={`${styles.option} ${props.value === year ? styles.optionSelected : ""}`}
                  onClick={() => {
                    props.onChange(year);
                    setIsOpen(false);
                  }}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
