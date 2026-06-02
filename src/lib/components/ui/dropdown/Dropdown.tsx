"use client";

import styles from "./dropdown.module.scss";
import { memo, useEffect, useRef, useState } from "react";

interface DropdownProps {
  dropdownItems: string[];
  dropdownPosition?: "bottom" | "top";
  label: string;
  placeholder: string;
  size?: "default" | "small";
  value?: string;
  onSelect: (value: string) => void;
}

function Dropdown({
  dropdownItems,
  dropdownPosition = "top",
  label,
  placeholder,
  size = "default",
  value,
  onSelect,
}: DropdownProps) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [dropdown, setDropdown] = useState(false);

  function handleCloseDropdown(e: MouseEvent) {
    const currentRef = dropdownRef.current;

    if (currentRef && !currentRef.contains(e.target as Node)) {
      setDropdown(false);
    }
  }

  useEffect(() => {
    document.addEventListener("mousedown", handleCloseDropdown);
    return () => document.removeEventListener("mousedown", handleCloseDropdown);
  }, []);

  return (
    <div
      className={`${styles.dropdown} ${styles[size]}
      ${styles[dropdownPosition]} ${dropdown ? styles.active : ""}`}
    >
      <span className={styles.label}>{label}</span>

      <input
        name="dropdown"
        placeholder={placeholder}
        readOnly
        value={value || ""}
        onClick={() => setDropdown(!dropdown)}
        onKeyDown={(e) => {
          if (e.key === "Backspace") {
            onSelect("");
          }
        }}
      />

      <img alt="" src="/icons/chevron.svg" />

      <div className={styles.dropdownGroup} ref={dropdown ? dropdownRef : null}>
        {dropdownItems.map((item, index) => (
          <span
            onClick={() => {
              setDropdown(false);
              onSelect(item);
            }}
            key={index}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export default memo(Dropdown);
