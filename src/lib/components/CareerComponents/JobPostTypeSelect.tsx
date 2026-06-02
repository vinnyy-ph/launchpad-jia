"use client";

import { useState, useEffect, useRef } from "react";

type JobPostType = "premium" | "credit-based" | null;

interface JobPostTypeOption {
  value: "premium" | "credit-based";
  label: string;
}

const JOB_POST_TYPE_OPTIONS: JobPostTypeOption[] = [
  {
    value: "premium",
    label: "Premium",
  },
  {
    value: "credit-based",
    label: "Credit-based",
  },
];

interface JobPostTypeSelectProps {
  value: JobPostType;
  onChange: (type: "premium" | "credit-based") => void;
  availableTypes: ("premium" | "credit-based")[];
  disabled?: boolean;
  error?: string;
}

/**
 * Dropdown selector for job post type based on org's available plans.
 * Auto-selects if only one option is available.
 */
export default function JobPostTypeSelect({
  value,
  onChange,
  availableTypes,
  disabled = false,
  error,
}: JobPostTypeSelectProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter options based on available types
  const filteredOptions = JOB_POST_TYPE_OPTIONS.filter((opt) =>
    availableTypes.includes(opt.value)
  );

  // Auto-select if only one option is available and no value is set
  useEffect(() => {
    if (filteredOptions.length === 1 && value === null) {
      onChange(filteredOptions[0].value);
    }
  }, [filteredOptions, value, onChange]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = JOB_POST_TYPE_OPTIONS.find((opt) => opt.value === value);
  const isDisabled = disabled || filteredOptions.length === 0;

  return (
    <div
      ref={dropdownRef}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        position: "relative",
        width: "100%",
      }}
    >
      <button
        disabled={isDisabled}
        type="button"
        onClick={() => setDropdownOpen((v) => !v)}
        style={{
          width: "100%",
          height: "48px",
          color: selectedOption ? "#111827" : "#717680",
          border: error ? "2px solid #EF4444" : "2px solid #E9EAEB",
          backgroundColor: isDisabled ? "#F9FAFB" : "#FFFFFF",
          borderRadius: "8px",
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: isDisabled ? "not-allowed" : "pointer",
          opacity: isDisabled ? 0.7 : 1,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {selectedOption ? (
            <span style={{ fontWeight: 500 }}>{selectedOption.label}</span>
          ) : (
            <span style={{ color: "#717680" }}>Select job post type</span>
          )}
        </span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          style={{
            transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="#717680"
            strokeWidth="1.67"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {error && !dropdownOpen && (
        <div style={{ minHeight: 18, marginTop: 4 }}>
          <span style={{ color: "#EF4444", fontSize: 12, fontWeight: 400 }}>
            {error}
          </span>
        </div>
      )}

      {dropdownOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(48px + 4px)",
            left: 0,
            right: 0,
            padding: 0,
            maxHeight: 200,
            overflowY: "auto",
            zIndex: 1000,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E9EAEB",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
          }}
        >
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setDropdownOpen(false);
              }}
              style={{
                width: "100%",
                padding: "12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: "none",
                backgroundColor: value === option.value ? "#F8F9FC" : "#FFFFFF",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  fontWeight: value === option.value ? 700 : 500,
                  color: "#111827",
                  flex: 1,
                  textAlign: "left",
                }}
              >
                {option.label}
              </span>
              {value === option.value && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M13.3334 4L6.00002 11.3333L2.66669 8"
                    stroke="#6941C6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

