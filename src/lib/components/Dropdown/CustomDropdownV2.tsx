"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "@/lib/styles/commonV2/dropdownV2.module.scss";

interface DropdownProps {
  value?: string;
  placeholder?: string;
  options: { name: string; icon?: string }[];
  onValueChange(value: string): void;
  disabled?: boolean;
  fullWidth?: boolean;
  invalid?: boolean;
}

export default function CustomDropdownV2({
  value,
  placeholder = "Select an option",
  options,
  onValueChange,
  disabled = false,
  fullWidth = true,
  invalid = false,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [icon, setIcon] = useState(options[0]?.icon);

  const handleSelect = (option: {name: string, icon?: string}) => {
    onValueChange?.(option.name);
    setIcon(option.icon);
    setIsOpen(false);
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className={`${styles.dropdownContainer} ${fullWidth ? styles.fullWidth : styles.fit}`}>
      <button
        type="button"
        className={`${styles.dropdownButton} ${isOpen ? styles.open : ""} ${
          disabled ? styles.disabled : ""
        } ${invalid ? styles.invalid : ""}`}
        onClick={handleToggle}
        disabled={disabled}
      >
        <span className={value ? styles.value : styles.placeholder}>
          <span className={icon} /> {value || placeholder}
        </span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 21"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={styles.chevron}
        >
          <path
            d="M5 7.85693L10 12.8569L15 7.85693"
            stroke="#717680"
            strokeWidth="1.67"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className={styles.dropdownMenu}>
          {options.map((option, index) => (
            <div
              key={index}
              className={`${styles.dropdownItem} ${
                option.name === value ? styles.selected : ""
              }`}
              onClick={() => handleSelect(option)}
              style={{ display: "flex", gap: "12px", alignItems: "center", justifyContent: "space-between" }}
            >
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <span className={option.icon || ""} />
                <span>{option.name}</span>
              </div>

              {option.name === value && (
                <Image 
                  src="/iconsV3/checkV6.svg" 
                  alt="Selected" 
                  width={20} 
                  height={21}
                  style={{ flexShrink: 0 }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

