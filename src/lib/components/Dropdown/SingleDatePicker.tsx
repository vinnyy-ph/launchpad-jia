"use client";
import { useState, useRef, useEffect } from "react";

interface SingleDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  placement?: "top" | "bottom";
  disabledDate?: (date: Date) => boolean;
  disabled?: boolean;
}

export default function SingleDatePicker({
  value,
  onChange,
  placeholder = "Select date",
  error = false,
  placement = "bottom",
  disabledDate,
  disabled = false,
}: SingleDatePickerProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const formatDateForValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    // Pad to complete the remaining cells so the calendar height remains constant
    while (days.length % 7 !== 0) {
      days.push(null);
    }
    while (days.length < 42) {
      days.push(null);
    }

    return days;
  };

  const isDateSelected = (date: Date) => {
    if (!value) return false;
    const selectedDate = new Date(value);
    return (
      date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate()
    );
  };

  const handleDateClick = (date: Date) => {
    onChange(formatDateForValue(date));
    setDropdownOpen(false);
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newMonth = new Date(currentMonth);
    if (direction === "prev") {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        setCurrentMonth(d);
      }
    }
  }, [value]);

  const monthName = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const days = getDaysInMonth(currentMonth);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        onClick={() => !disabled && setDropdownOpen(!dropdownOpen)}
        style={{
          width: "100%",
          padding: "10px 14px",
          border: `1px solid ${error ? "#F04438" : "#E9EAEB"}`,
          borderRadius: 8,
          fontSize: 16,
          color: value ? (disabled ? "#717680" : "#181D27") : "#717680",
          background: disabled ? "#F9FAFB" : "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: disabled ? 0.7 : 1,
        }}
      >
        <span>{value ? formatDateForDisplay(value) : placeholder}</span>
        <i className="la la-calendar" style={{ color: "#717680", fontSize: 18 }} />
      </div>

      {dropdownOpen && !disabled && (
        <div
          style={{
            position: "absolute",
            ...(placement === "top"
              ? { bottom: "calc(100% + 4px)" }
              : { top: "calc(100% + 4px)" }),
            left: 0,
            zIndex: 100,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
            border: "1px solid #E9EAEB",
            padding: 16,
            width: 280,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <button
              type="button"
              onClick={() => navigateMonth("prev")}
              style={{
                width: 32,
                height: 32,
                border: "none",
                background: "#F5F5F5",
                borderRadius: 4,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#666",
              }}
            >
              <i className="la la-chevron-left" />
            </button>
            <span
              style={{
                fontWeight: "bold",
                fontSize: 16,
                color: "#181D27",
              }}
            >
              {monthName}
            </span>
            <button
              type="button"
              onClick={() => navigateMonth("next")}
              style={{
                width: 32,
                height: 32,
                border: "none",
                background: "#F5F5F5",
                borderRadius: 4,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#666",
              }}
            >
              <i className="la la-chevron-right" />
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 0,
              marginBottom: 8,
            }}
          >
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <div
                key={day}
                style={{
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#717680",
                  padding: "8px 0",
                }}
              >
                {day}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "4px 0",
            }}
          >
            {days.map((day, index) => {
              if (!day) {
                return <div key={index} style={{ height: 32 }} />;
              }

              const isSelected = isDateSelected(day);
              const isDisabled = disabledDate ? disabledDate(day) : false;

              return (
                <button
                  type="button"
                  key={index}
                  onClick={() => !isDisabled && handleDateClick(day)}
                  disabled={isDisabled}
                  style={{
                    width: "100%",
                    height: 32,
                    border: "none",
                    borderRadius: isSelected ? "50%" : 0,
                    background: isDisabled
                      ? "#F9FAFB"
                      : isSelected
                        ? "linear-gradient(135deg, #FCCEC0, #EBACC9, #CEB6DA, #9FCAED)"
                        : "transparent",
                    color: isDisabled
                      ? "#D1D5DB"
                      : isSelected
                        ? "#FFFFFF"
                        : "#181D27",
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    fontSize: 14,
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isDisabled && !isSelected) {
                      e.currentTarget.style.background = "#F3F4F6";
                      e.currentTarget.style.borderRadius = "50%";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isDisabled && !isSelected) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.borderRadius = "0";
                    }
                  }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
