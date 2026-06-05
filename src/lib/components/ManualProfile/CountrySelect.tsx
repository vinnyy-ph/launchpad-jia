"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "@untitledui/icons";
import {
  PHONE_COUNTRY_OPTIONS,
  type SupportedPhoneCountry,
} from "@/lib/utils/phoneInput";
import styles from "./manual-profile.module.scss";

// Display metadata kept local so the shared PHONE_COUNTRY_OPTIONS stays unchanged.
// `iso` is the flagcdn country code (UK uses the ISO "gb").
const COUNTRY_META: Record<SupportedPhoneCountry, { name: string; iso: string }> = {
  PH: { name: "Philippines", iso: "ph" },
  US: { name: "United States", iso: "us" },
  SG: { name: "Singapore", iso: "sg" },
  AU: { name: "Australia", iso: "au" },
  UK: { name: "United Kingdom", iso: "gb" },
};

interface CountrySelectProps {
  value: SupportedPhoneCountry;
  onChange: (next: SupportedPhoneCountry) => void;
  /** Read-only display (no popover) — used on the confirm step. */
  disabled?: boolean;
}

function FlagIcon({ country }: { country: SupportedPhoneCountry }) {
  return (
    <img
      className={styles.countryFlag}
      src={`https://flagcdn.com/${COUNTRY_META[country].iso}.svg`}
      alt=""
      aria-hidden
    />
  );
}

// Custom country dropdown for the mobile-number field. Replaces the native
// <select> with a design-system-styled button trigger + popover listbox. Mirrors
// the keyboard/close behaviour of ui/Select (arrow keys, Enter, Escape, Tab,
// outside click) without touching that shared component.
export default function CountrySelect({
  value,
  onChange,
  disabled = false,
}: CountrySelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [opened, setOpened] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const options = PHONE_COUNTRY_OPTIONS;
  const selectedIndex = options.findIndex((option) => option.code === value);

  useEffect(() => {
    if (!opened) return;
    function handleMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpened(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [opened]);

  useEffect(() => {
    if (opened) {
      setHighlighted(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [opened, selectedIndex]);

  function close(focusTrigger = true) {
    setOpened(false);
    if (focusTrigger) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }

  function selectCountry(code: SupportedPhoneCountry) {
    onChange(code);
    close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!opened) {
          setOpened(true);
          return;
        }
        setHighlighted((index) => (index + 1) % options.length);
        return;
      case "ArrowUp":
        event.preventDefault();
        if (!opened) {
          setOpened(true);
          return;
        }
        setHighlighted((index) => (index - 1 + options.length) % options.length);
        return;
      case "Enter":
        event.preventDefault();
        if (!opened) {
          setOpened(true);
          return;
        }
        selectCountry(options[highlighted].code);
        return;
      case "Escape":
        if (opened) {
          event.preventDefault();
          close();
        }
        return;
      case "Tab":
        if (opened) {
          setOpened(false);
        }
        return;
      default:
    }
  }

  const selectedMeta = COUNTRY_META[value];

  return (
    <div ref={rootRef} className={styles.countrySelect}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.countryTrigger}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={opened}
        aria-label={`Phone country: ${selectedMeta.name}`}
        onClick={() => {
          if (disabled) return;
          setOpened((current) => !current);
        }}
        onKeyDown={handleKeyDown}
      >
        <FlagIcon country={value} />
        <span className={styles.countryCode}>{value}</span>
        {!disabled && (
          <ChevronDown
            className={`${styles.countryChevron}${opened ? ` ${styles.countryChevronOpen}` : ""}`}
            aria-hidden
          />
        )}
      </button>

      {opened && (
        <div className={styles.countryMenu} role="listbox" aria-label="Select country">
          {options.map((option, index) => {
            const meta = COUNTRY_META[option.code];
            const isSelected = option.code === value;
            const isHighlighted = index === highlighted;
            return (
              <button
                key={option.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`${styles.countryOption}${
                  isHighlighted ? ` ${styles.countryOptionHighlighted}` : ""
                }${isSelected ? ` ${styles.countryOptionSelected}` : ""}`}
                onMouseEnter={() => setHighlighted(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectCountry(option.code)}
              >
                <FlagIcon country={option.code} />
                <span className={styles.countryOptionName}>{meta.name}</span>
                <span className={styles.countryOptionDial}>{option.dialCode}</span>
                <span className={styles.countryOptionCheck}>
                  {isSelected ? <Check size={16} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
