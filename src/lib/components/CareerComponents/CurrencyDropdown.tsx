"use client";
import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "@untitledui/icons";

export default function CurrencyDropdown({
  currency,
  onCurrencyChange,
  currencyOptions,
  disabled,
  fullWidth = false,
  minimal = false,
  flatStyle = false,
}: {
  currency: string;
  onCurrencyChange: (currency: string) => void;
  currencyOptions: { name: string; symbol: string }[];
  disabled?: boolean;
  fullWidth?: boolean;
  minimal?: boolean;
  flatStyle?: boolean;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const buttonHeight = minimal ? "auto" : "48px";
  const buttonPadding = minimal ? "0" : "0 12px";
  const buttonGap = minimal ? "2px" : "4px";
  const buttonColor = disabled ? "#9CA3AF" : minimal ? "#535862" : "#181D27";
  const buttonFontWeight = minimal ? 500 : 400;

  return (
    <div
      ref={dropdownRef}
      style={{
        position: "relative",
        display: fullWidth ? "block" : "inline-block",
        width: fullWidth ? "100%" : "auto",
        zIndex: dropdownOpen ? 1001 : "auto",
      }}
    >
      <button
        type="button"
        disabled={disabled}
        className="fade-in-bottom"
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        aria-expanded={dropdownOpen}
        style={{
          height: buttonHeight,
          background: minimal ? "transparent" : "#FFFFFF",
          border: minimal ? "none" : "2px solid #E9EAEB",
          borderRadius: flatStyle ? 0 : "8px",
          boxShadow: "none",
          color: buttonColor,
          fontSize: "16px",
          cursor: disabled ? "not-allowed" : "pointer",
          padding: buttonPadding,
          display: "flex",
          alignItems: "center",
          gap: buttonGap,
          fontWeight: buttonFontWeight,
          outline: "none",
          width: fullWidth ? "100%" : "auto",
          justifyContent: fullWidth ? "space-between" : "flex-start",
        }}
        onClick={() => !disabled && setDropdownOpen(!dropdownOpen)}
      >
        {currency}
        <ChevronDown size={16} color={buttonColor} />
      </button>
      {dropdownOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: "0",
            left: fullWidth ? "0" : "auto",
            marginTop: "4px",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E9EAEB",
            borderRadius: flatStyle ? 0 : "8px",
            boxShadow: flatStyle ? "none" : "0 4px 12px rgba(0, 0, 0, 0.1)",
            zIndex: 1000,
            minWidth: "100px",
            width: fullWidth ? "100%" : "auto",
            overflow: "hidden",
          }}
        >
          {currencyOptions.map((option, index) => (
            <button
              key={index}
              type="button"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "none",
                borderRadius: flatStyle ? 0 : undefined,
                boxShadow: "none",
                background:
                  currency === option.name ? "#F8F9FC" : "transparent",
                color: "#181D27",
                fontSize: "16px",
                fontWeight: currency === option.name ? 700 : 500,
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                outline: "none",
              }}
              onClick={() => {
                onCurrencyChange(option.name);
                setDropdownOpen(false);
              }}
              onMouseEnter={(e) => {
                if (currency !== option.name) {
                  e.currentTarget.style.background = "#F8F9FC";
                }
              }}
              onMouseLeave={(e) => {
                if (currency !== option.name) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <span>
                {option.symbol} {option.name}
              </span>
              {currency === option.name && (
                <Check
                  size={16}
                  color="#039855"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
