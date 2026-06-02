import React from "react";
import styles from "@/lib/styles/screens/settings.module.scss";

interface DropdownItem {
  value: string | number;
  label: string;
}

interface DropdownProps {
  id: string;
  label: string;
  data: {
    item: DropdownItem[];
  };
  value: string | number;
  onChange: (id: string, value: string | number) => void;
  activeDropdown: string | null;
  setActiveDropdown: (id: string | null) => void;
}

export default function Dropdown({
  id,
  label,
  data,
  value,
  onChange,
  activeDropdown,
  setActiveDropdown,
}: DropdownProps) {
  return (
    <div className={styles.dropdown}>
      <span>{label}</span>

      <div
        className={styles.value}
        onClick={() => setActiveDropdown(activeDropdown === id ? null : id)}
      >
        <span>
          {data.item.find((item) => item.value === value)?.label ||
            "Select an option"}
        </span>

        <img
          alt=""
          className={activeDropdown === id ? styles.active : ""}
          src="/icons/chevron.svg"
        />
      </div>

      {activeDropdown === id && (
        <div className={styles.dropdownContainer}>
          {data.item.map((item, index) => (
            <span
              className={item.value === value ? styles.active : ""}
              key={index}
              onClick={() => {
                setActiveDropdown(null);
                onChange(id, item.value);
              }}
            >
              {item.label}

              {item.value === value && <img alt="" src="/icons/checkV4.svg" />}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
