import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useLayoutEffect,
} from "react";
import styles from "@/lib/components/MailgunComponents/editor/editor.module.scss";
import AvatarImage from "@/lib/components/AvatarImage/AvatarImage";

export interface AutocompleteOption {
  value: string;
  label: string;
  subtitle?: string;
  email?: string;
  imageSrc?: string;
}

interface AutocompleteFieldProps {
  options: AutocompleteOption[];
  value: AutocompleteOption[];
  onChange: (value: AutocompleteOption[]) => void;
  selectionMode: "single" | "multiple";
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  withoutAvatar?: boolean;
  withoutSubtitle?: boolean;
  showRecepientUI?: boolean;
  displayValue?: AutocompleteOption[];
  gmailEmails?: string[];
  outlookEmails?: string[];
  renderTag?: (option: AutocompleteOption) => React.ReactNode;
  isLoading?: boolean;
}

const AutocompleteField: React.FC<AutocompleteFieldProps> = ({
  options,
  value,
  onChange,
  selectionMode,
  placeholder,
  disabled = false,
  readOnly = false,
  withoutAvatar = false,
  withoutSubtitle = false,
  showRecepientUI = true,
  displayValue,
  gmailEmails = [],
  outlookEmails = [],
  renderTag,
  isLoading = false,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isRecipientsExpanded, setIsRecipientsExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(
    showRecepientUI ? value.length : displayValue?.length || value.length || 0,
  );
  const [containerWidth, setContainerWidth] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const moreMeasureRef = useRef<HTMLDivElement>(null);
  const tagRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const effectiveValue = showRecepientUI
    ? value
    : displayValue && displayValue.length > 0
      ? displayValue
      : value;

  const isOptionsLoading = isLoading || options == null;
  const isDisplayValueLoading =
    typeof displayValue !== "undefined" &&
    Array.isArray(displayValue) &&
    displayValue.length === 0;
  const showLoading = isOptionsLoading || isDisplayValueLoading;

  // Initialize visibleCount when effectiveValue changes (before measurement)
  useEffect(() => {
    if (showRecepientUI) {
      setVisibleCount(effectiveValue.length);
    } else if (effectiveValue.length > 0) {
      // Start by showing all tags, useLayoutEffect will recalculate if needed
      setVisibleCount(effectiveValue.length);
    } else {
      setVisibleCount(0);
    }
  }, [effectiveValue.length, showRecepientUI]);

  // Filter options based on input value
  const filteredOptions = useMemo(() => {
    if (!inputValue.trim()) return options;
    const lowerInput = inputValue.toLowerCase();
    return options.filter((option) => {
      const subtitle = option.subtitle || "";
      return (
        option.label.toLowerCase().includes(lowerInput) ||
        option.value.toLowerCase().includes(lowerInput) ||
        subtitle.toLowerCase().includes(lowerInput)
      );
    });
  }, [inputValue, options]);
  // Get available options while excluding already selected in multi-select
  const availableOptions = useMemo(() => {
    if (selectionMode === "single") return filteredOptions;
    const selectedValues = new Set(value.map((v) => v.value));
    return filteredOptions.filter((opt) => !selectedValues.has(opt.value));
  }, [filteredOptions, value, selectionMode]);

  // Handle clicking outside to close dropdown and collapse expanded recipients
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
        setIsRecipientsExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Track container width for overflow calculations
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !window.ResizeObserver) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (showRecepientUI) {
      setVisibleCount(effectiveValue.length);
      return;
    }

    const container = containerRef.current;
    if (!container || effectiveValue.length === 0) {
      setVisibleCount(0);
      return;
    }

    // Use double requestAnimationFrame to ensure DOM is fully laid out
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const widths = effectiveValue.map(
          (v) =>
            tagRefs.current.get(v.value)?.getBoundingClientRect().width || 0,
        );

        // If widths aren't available yet or all are 0, show all tags
        const hasValidWidths = widths.some((w) => w > 0);
        if (!hasValidWidths) {
          setVisibleCount(effectiveValue.length);
          return;
        }

        const measureMoreWidth = (count: number) => {
          if (!moreMeasureRef.current) return 56;
          moreMeasureRef.current.textContent = `+${count} more`;
          return moreMeasureRef.current.getBoundingClientRect().width || 56;
        };

        const available =
          containerWidth || container.getBoundingClientRect().width;
        if (available === 0 || available < 50) {
          // Container not measured yet or too small, show all tags
          setVisibleCount(effectiveValue.length);
          return;
        }

        let used = 0;
        let nextVisible = 0;

        for (let i = 0; i < widths.length; i += 1) {
          const tagWidth = widths[i];
          if (tagWidth === 0) {
            // Skip tags with no width (not measured yet)
            continue;
          }

          const remaining = widths.length - (nextVisible + 1);
          const indicatorWidth =
            remaining > 0 ? measureMoreWidth(remaining) : 0;
          const candidate =
            used + tagWidth + (remaining > 0 ? indicatorWidth : 0);

          if (candidate <= available) {
            used += tagWidth;
            nextVisible += 1;
          } else {
            break;
          }
        }

        // Ensure at least one tag is visible if there are tags
        if (nextVisible === 0 && effectiveValue.length > 0) {
          nextVisible = 1;
        }

        setVisibleCount(nextVisible);
      });
    });
  }, [effectiveValue, showRecepientUI, containerWidth]);

  // Reset highlighted index when available options change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [availableOptions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // Check if input contains comma (for multi-email paste)
    if (newValue.includes(",")) {
      handleCommaInput(newValue);
    } else {
      setInputValue(newValue);
      setIsDropdownOpen(true);
      setHighlightedIndex(-1);
    }
  };

  const handleCommaInput = (input: string) => {
    // Split by comma and trim each value
    const entries = input.split(",").map((entry) => entry.trim());

    // Find matching options for each entry
    const newSelections: AutocompleteOption[] = [];
    const invalidEntries: string[] = [];
    const selectedValues = new Set(value.map((v) => v.value));

    entries.forEach((entry) => {
      if (entry) {
        const matchingOption = options.find(
          (opt) =>
            opt.value.toLowerCase() === entry.toLowerCase() ||
            opt.label.toLowerCase() === entry.toLowerCase(),
        );

        // Add to selection if found and not already selected
        if (matchingOption && !selectedValues.has(matchingOption.value)) {
          newSelections.push(matchingOption);
          selectedValues.add(matchingOption.value);
        } else if (!matchingOption) {
          // Collect invalid entries
          invalidEntries.push(entry);
        }
      }
    });

    // Update value with new selections
    if (newSelections.length > 0) {
      if (selectionMode === "single") {
        onChange([newSelections[newSelections.length - 1]]);
      } else {
        onChange([...value, ...newSelections]);
      }
    }

    // Keep invalid entries in input field, comma-separated
    const remainingInput = invalidEntries.join(", ");
    setInputValue(remainingInput);
    setIsDropdownOpen(!!remainingInput);
    setHighlightedIndex(-1);
  };

  // Handle selecting an option
  const handleOptionSelect = useCallback(
    (option: AutocompleteOption) => {
      if (selectionMode === "single") {
        onChange([option]);
      } else {
        onChange([...value, option]);
      }
      setInputValue("");
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
      inputRef.current?.focus();
    },
    [value, onChange, selectionMode],
  );

  // Handle removing a selected tag
  const handleRemoveTag = (optionValue: string) => {
    const newValue = value.filter((v) => v.value !== optionValue);
    onChange(newValue);
  };

  // Handle keyboard navigation in options
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled || readOnly) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!isDropdownOpen) {
          setIsDropdownOpen(true);
        } else {
          setHighlightedIndex((prev) =>
            prev < availableOptions.length - 1 ? prev + 1 : prev,
          );
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;

      case "Enter":
        e.preventDefault();
        if (isDropdownOpen && highlightedIndex >= 0) {
          handleOptionSelect(availableOptions[highlightedIndex]);
        }
        break;

      case "Escape":
        e.preventDefault();
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
        break;

      case "Backspace":
        if (!readOnly && inputValue === "" && value.length > 0) {
          e.preventDefault();
          const newValue = value.slice(0, -1);
          onChange(newValue);
        }
        break;

      default:
        break;
    }
  };

  // Handle input focus to open dropdown
  const handleInputFocus = () => {
    if (!disabled) {
      setIsDropdownOpen(true);
    }
  };

  // Determine tags to display based on available space (or expanded state)
  const displayedTags = showRecepientUI
    ? value
    : isRecipientsExpanded
      ? effectiveValue
      : effectiveValue.slice(0, visibleCount);
  const hiddenCount = showRecepientUI
    ? 0
    : isRecipientsExpanded
      ? 0
      : Math.max(0, effectiveValue.length - visibleCount);

  return (
    <div ref={containerRef} className={styles.autocompleteField}>
      <div ref={moreMeasureRef} className={styles.tagItemCount}>
        +0 more
      </div>
      <div className={styles.tagMeasureContainer}>
        {effectiveValue.map((option) => (
          <div
            key={`measure-${option.value}`}
            className={styles.tagItem}
            ref={(el) => {
              if (!el) {
                tagRefs.current.delete(option.value);
              } else {
                tagRefs.current.set(option.value, el);
              }
            }}
          >
            {!withoutAvatar && (
              <AvatarImage
                src={
                  option?.imageSrc
                    ? option.imageSrc
                    : `https://api.dicebear.com/9.x/glass/svg?seed=${option?.label}`
                }
                alt={option?.label}
              />
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span>{option.label}</span>
              {option.subtitle && (
                <span style={{ fontSize: 12, color: "#717680" }}>
                  {option.subtitle}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tags and Input */}
      <div
        className={styles.tagsInput}
        style={{
          flexWrap:
            showRecepientUI || isRecipientsExpanded ? "wrap" : "nowrap",
        }}
        onClick={() => !disabled && !readOnly && inputRef.current?.focus()}
      >
        {showLoading ? (
          <span style={{ fontSize: 14, fontWeight: 500 }}>Loading...</span>
        ) : (
          <>
            {/* Selected Tags */}
            {displayedTags.map((option) => {
              const isGmail = gmailEmails.includes(option.email ?? "");
              return (
                <div
                  key={option.value}
                  className={styles.tagItem}
                  style={{ paddingRight: showRecepientUI && !readOnly ? 4 : 7 }}
                >
                  {!withoutAvatar && (
                    <AvatarImage
                      src={
                        option?.imageSrc
                          ? option.imageSrc
                          : `https://api.dicebear.com/9.x/glass/svg?seed=${option?.label}`
                      }
                      alt={option?.label}
                    />
                  )}
                  <span>{renderTag ? renderTag(option) : option.label}</span>
                  {isGmail && (
                    <img
                      src="/icons/gmail.svg"
                      alt="Gmail"
                      style={{ width: 12, height: 12 }}
                    />
                  )}
                  {outlookEmails.includes(option.email ?? "") && (
                    <img
                      src="/icons/outlook.svg"
                      alt="Outlook"
                      style={{ width: 12, height: 12 }}
                    />
                  )}
                  {!disabled && !readOnly && showRecepientUI && (
                    <img
                      src="/iconsV3/x.svg"
                      alt="close"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveTag(option.value);
                      }}
                      style={{ width: 14, height: 14 }}
                    />
                  )}
                </div>
              );
            })}
            {!showRecepientUI && hiddenCount > 0 && (
              <div
                role="button"
                tabIndex={0}
                className={styles.tagItem}
                style={{
                  paddingRight: 7,
                  background: "#F9F9FB",
                  cursor: "pointer",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRecipientsExpanded(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsRecipientsExpanded(true);
                  }
                }}
              >
                +{hiddenCount} more
              </div>
            )}
            {/* Input Field - hidden when readOnly so recipients cannot be added or removed */}
            {showRecepientUI && !readOnly && (
              <input
                ref={inputRef}
                className={styles.inputField}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={handleInputFocus}
                placeholder={value.length === 0 ? placeholder : ""}
                disabled={disabled}
              />
            )}
          </>
        )}
      </div>

      {/* Dropdown Menu */}
      {!showLoading &&
        isDropdownOpen &&
        availableOptions.length > 0 &&
        !disabled &&
        !readOnly && (
          <div ref={dropdownRef} className={styles.dropdownContainer}>
            {availableOptions.map((option, index) => {
              const isGmail = gmailEmails.includes(option.email ?? "");
              return (
                <div
                  key={`${option.value}-${index}`}
                  onClick={() => handleOptionSelect(option)}
                  className={styles.optionItem}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {!withoutAvatar && (
                    <div style={{ position: "relative" }}>
                      <AvatarImage
                        src={
                          option?.imageSrc
                            ? option.imageSrc
                            : `https://api.dicebear.com/9.x/glass/svg?seed=${option?.label}`
                        }
                        alt={option?.label}
                      />
                      {isGmail && (
                        <span
                          title="Gmail Integration"
                          className={styles.gmailIconContainer}
                        >
                          <img
                            src="/icons/gmail.svg"
                            alt="Gmail"
                            style={{ width: 10, height: 10 }}
                          />
                        </span>
                      )}
                      {outlookEmails.includes(option.email ?? "") && (
                        <span
                          title="Outlook Integration"
                          className={styles.gmailIconContainer}
                        >
                          <img
                            src="/icons/outlook.svg"
                            alt="Outlook"
                            style={{ width: 10, height: 10 }}
                          />
                        </span>
                      )}
                    </div>
                  )}
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#1f2937",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {option.label}
                    </div>
                    {!withoutSubtitle &&
                      (() => {
                        const secondary =
                          option.subtitle ||
                          (option.value !== option.label ? option.value : null);
                        return secondary ? (
                          <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                            {secondary}
                          </div>
                        ) : null;
                      })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
};

export default AutocompleteField;
