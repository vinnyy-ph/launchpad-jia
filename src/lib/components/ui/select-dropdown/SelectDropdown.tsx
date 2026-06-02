"use client";

import styles from "./select-dropdown.module.scss";
import { memo, useEffect, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectDropdownProps {
  options: SelectOption[];
  value: string | null;
  onSelect: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  hasError?: boolean;
  errorText?: string;
  size?: "default" | "small";
  position?: "top" | "bottom";
  wide?: boolean;
  noShadow?: boolean;
}

function SelectDropdown({
  options,
  value,
  onSelect,
  label,
  placeholder = "Select...",
  required = false,
  hasError = false,
  errorText,
  size = "default",
  position = "top",
  wide = false,
  noShadow = false,
}: SelectDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onSelect(optionValue);
    setIsOpen(false);
  };

  const containerClasses = [
    styles.selectDropdown,
    styles[size],
    styles[position],
    isOpen ? styles.active : "",
    hasError ? styles.hasError : "",
    noShadow ? styles.noShadow : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses} ref={dropdownRef}>
      {label && (
        <span className={styles.label}>
          {label}
          {required && <span className={styles.required}> *</span>}
        </span>
      )}

      <div className={styles.triggerWrapper}>
        <button
          type="button"
          className={`${styles.trigger} ${!selectedOption ? styles.placeholder : ""}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          {selectedOption?.label || placeholder}
        </button>

        <img className={styles.chevron} alt="" src="/icons/chevron.svg" />
      </div>

      <div className={`${styles.menu} ${wide ? styles.menuWide : ""}`}>
        {options.map((option) => (
          <div
            key={option.value}
            className={`${styles.option} ${value === option.value ? styles.selected : ""}`}
            onClick={() => handleSelect(option.value)}
          >
            <div className={styles.optionHeader}>
              <span className={styles.optionLabel}>{option.label}</span>
              {value === option.value && <i className={`la la-check ${styles.checkIcon}`} />}
            </div>
            {option.description && <p className={styles.optionDesc}>{option.description}</p>}
          </div>
        ))}
      </div>

      {hasError && errorText && <span className={styles.errorText}>{errorText}</span>}
    </div>
  );
}

export default memo(SelectDropdown);
