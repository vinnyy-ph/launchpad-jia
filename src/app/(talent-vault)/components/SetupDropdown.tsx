"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Chevron } from "./icons/Chevron";
import styles from "@/app/(talent-vault)/styles/modules/setup-dropdown.module.scss";

export const OTHERS_OPTION_VALUE = "__others__";

export type SetupDropdownOption = {
  value: string;
  label: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
};

type SetupDropdownProps = {
  options: SetupDropdownOption[];
  value?: string | null;
  placeholder?: string;
  onChange(value: string): void;
  onSearchChange?(value: string): void;
  othersValue?: string;
  onOthersChange?(value: string): void;
  disabled?: boolean;
  enableOthersOption?: boolean;
  enableSearch?: boolean;
  inputPrefix?: ReactNode;
  inputSuffix?: ReactNode;
};

export function SetupDropdown({
  options,
  value,
  placeholder = "Select",
  onChange,
  onSearchChange,
  othersValue,
  onOthersChange,
  disabled = false,
  enableOthersOption = true,
  enableSearch = true,
  inputPrefix,
  inputSuffix,
}: SetupDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [othersText, setOthersText] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const renderedOthersText = othersValue ?? othersText;

  const allOptions = useMemo(
    () => {
      const baseOptions = options.filter((option) => option.value !== OTHERS_OPTION_VALUE);

      if (!enableOthersOption) {
        return baseOptions;
      }

      return [
        ...baseOptions,
        { value: OTHERS_OPTION_VALUE, label: "Others" },
      ];
    },
    [options, enableOthersOption]
  );

  const selectedOption = useMemo(
    () => allOptions.find((option) => option.value === value),
    [allOptions, value]
  );

  const filteredOptions = useMemo(() => {
    if (!enableSearch) {
      return allOptions;
    }

    const query = search.trim().toLowerCase();
    if (!query) return allOptions;

    return allOptions.filter((option) =>
      option.label.toLowerCase().includes(query)
    );
  }, [allOptions, search, enableSearch]);

  const menuOptions = useMemo(() => {
    const others = filteredOptions.find(
      (option) => option.value === OTHERS_OPTION_VALUE
    );

    if (!value) {
      if (!others) return filteredOptions;
      return [
        others,
        ...filteredOptions.filter((option) => option.value !== OTHERS_OPTION_VALUE),
      ];
    }

    const selected = filteredOptions.find((option) => option.value === value);
    if (!selected) return filteredOptions;

    if (selected.value === OTHERS_OPTION_VALUE) {
      return [
        selected,
        ...filteredOptions.filter((option) => option.value !== OTHERS_OPTION_VALUE),
      ];
    }

    if (!others) {
      return [selected, ...filteredOptions.filter((option) => option.value !== value)];
    }

    return [
      selected,
      others,
      ...filteredOptions.filter(
        (option) =>
          option.value !== value && option.value !== OTHERS_OPTION_VALUE
      ),
    ];
  }, [filteredOptions, value]);

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
    if (!isOpen || !enableSearch || !onSearchChange) return;
    onSearchChange(search);
  }, [isOpen, enableSearch, onSearchChange, search]);

  return (
    <div ref={rootRef} className={styles.root}>
      <div className={styles.anchor}>
        <button
          type="button"
          className={styles.input}
          onClick={() => {
            if (disabled) return;
            setIsOpen((prev) => {
              const next = !prev;
              if (!next) setSearch("");
              return next;
            });
          }}
          disabled={disabled}
        >
          {inputPrefix}
          <span className={`${styles.value} ${selectedOption ? styles.selected : styles.placeholder}`}>
            {selectedOption?.label || placeholder}
          </span>
          {inputSuffix}
          <Chevron direction={isOpen ? "up" : "down"} />
        </button>

        {isOpen && (
          <div className={styles.menu}>
            {enableSearch && (
              <div className={styles.searchRow}>
                <div className={styles.searchBox}>
                  <img className={styles.searchIcon} src="/iconsV3/search.svg" alt="Search icon" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search"
                    autoFocus
                    className={styles.searchInput}
                  />
                </div>
              </div>
            )}

            {menuOptions.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  type="button"
                  key={option.value}
                  className={`${styles.option} ${isSelected ? styles.optionSelected : ""}`}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  {option.prefix}
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.suffix}
                  <span className={styles.checkSlot}>
                    {isSelected ? (
                      <Image
                        src="/iconsV3/checkV6.svg"
                        alt="Selected"
                        width={20}
                        height={21}
                      />
                    ) : null}
                  </span>
                </button>
              );
            })}

            {menuOptions.length === 0 && (
              <div className={styles.option}>
                <span className={styles.optionLabel}>No matches found</span>
                <span className={styles.checkSlot} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Others field */}
      {enableOthersOption && value === OTHERS_OPTION_VALUE && (
        <div className={styles.othersRow}>
          <span className={styles.othersLabel}>Others (please specify):</span>
          <input
            type="text"
            className={styles.othersInput}
            value={renderedOthersText}
            onChange={(event) => {
              if (onOthersChange) {
                onOthersChange(event.target.value);
                return;
              }

              setOthersText(event.target.value);
            }}
            placeholder={placeholder}
          />
        </div>
      )}
    </div>
  );
}
