"use client";

import {
  CSSProperties,
  KeyboardEvent,
  ReactNode,
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, SearchLg } from "@untitledui/icons";
import styles from "./select.module.scss";

const SELECT_RADIUS = {
  xs: "4px",
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
} as const;

type SelectSize = "xs" | "sm" | "md" | "lg" | "xl";
type SelectRadius = keyof typeof SELECT_RADIUS | number | string;
type SelectDataItem = string | { value: string; label: string; disabled?: boolean };

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  allowDeselect?: boolean;
  checkIconPosition?: "left" | "right";
  className?: string;
  clearable?: boolean;
  data: SelectDataItem[];
  defaultValue?: string | null;
  description?: ReactNode;
  disabled?: boolean;
  dropdownPosition?: "bottom" | "top";
  error?: ReactNode;
  id?: string;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  iconWidth?: number | string;
  label?: ReactNode;
  limit?: number;
  maxDropdownHeight?: number | string;
  name?: string;
  nothingFoundMessage?: ReactNode;
  onChange?: (value: string | null, option: SelectOption | null) => void;
  onSearchChange?: (value: string) => void;
  placeholder?: string;
  radius?: SelectRadius;
  readOnly?: boolean;
  required?: boolean;
  searchValue?: string;
  searchable?: boolean;
  size?: SelectSize;
  style?: CSSProperties;
  value?: string | null;
  withAsterisk?: boolean;
}

function cx(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function resolveCssValue(value: string | number) {
  return typeof value === "number" ? `${value}px` : value;
}

function resolveRadius(radius: SelectRadius) {
  if (typeof radius === "number") {
    return `${radius}px`;
  }

  if (typeof radius === "string" && radius in SELECT_RADIUS) {
    return SELECT_RADIUS[radius as keyof typeof SELECT_RADIUS];
  }

  return radius;
}

function normalizeData(data: SelectDataItem[]): SelectOption[] {
  return data.map((item) => {
    if (typeof item === "string") {
      return { value: item, label: item };
    }

    return item;
  });
}

function getNextEnabledIndex(
  options: SelectOption[],
  current: number,
  direction: 1 | -1,
) {
  if (!options.length) return -1;

  let index = current;
  for (let i = 0; i < options.length; i += 1) {
    index = (index + direction + options.length) % options.length;
    if (!options[index].disabled) {
      return index;
    }
  }

  return -1;
}

function Select({
  allowDeselect = false,
  checkIconPosition = "right",
  className,
  clearable = false,
  data,
  defaultValue = null,
  description,
  disabled = false,
  dropdownPosition = "bottom",
  error,
  id,
  icon,
  iconPosition = "left",
  iconWidth = 36,
  label,
  limit,
  maxDropdownHeight = 280,
  name,
  nothingFoundMessage = "No options",
  onChange,
  onSearchChange,
  placeholder = "Select value",
  radius = "md",
  readOnly = false,
  required = false,
  searchValue,
  searchable = false,
  size = "md",
  style,
  value,
  withAsterisk = false,
}: SelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const inputId = id || `select-${generatedId}`;

  const isControlled = value !== undefined;
  const isSearchControlled = searchValue !== undefined;

  const [opened, setOpened] = useState(false);
  const [internalValue, setInternalValue] = useState<string | null>(defaultValue);
  const [internalSearch, setInternalSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const options = useMemo(() => normalizeData(data), [data]);
  const selectedValue = isControlled ? value ?? null : internalValue;
  const selectedOption = options.find((item) => item.value === selectedValue) ?? null;
  const resolvedSearch = isSearchControlled ? searchValue : internalSearch;

  const filteredOptions = useMemo(() => {
    const query = resolvedSearch.trim().toLowerCase();
    const base = query
      ? options.filter((item) => item.label.toLowerCase().includes(query))
      : options;

    if (typeof limit === "number" && limit > 0) {
      return base.slice(0, limit);
    }

    return base;
  }, [limit, options, resolvedSearch]);

  const canClear =
    clearable && !disabled && !readOnly && selectedValue !== null && selectedValue !== "";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpened(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!opened || !searchable) return;

    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, [opened, searchable]);

  useEffect(() => {
    if (!opened) return;

    const selectedIndex = filteredOptions.findIndex(
      (item) => item.value === selectedValue && !item.disabled,
    );

    if (selectedIndex >= 0) {
      setHighlightedIndex(selectedIndex);
      return;
    }

    const firstEnabled = filteredOptions.findIndex((item) => !item.disabled);
    setHighlightedIndex(firstEnabled);
  }, [filteredOptions, opened, selectedValue]);

  function updateSearch(nextSearch: string) {
    if (!isSearchControlled) {
      setInternalSearch(nextSearch);
    }

    onSearchChange?.(nextSearch);
  }

  function clearSearch() {
    updateSearch("");
  }

  function selectOption(option: SelectOption | null) {
    const nextValue = option?.value ?? null;

    if (!isControlled) {
      setInternalValue(nextValue);
    }

    onChange?.(nextValue, option);
    setOpened(false);
    clearSearch();
  }

  function handleOptionClick(option: SelectOption) {
    if (option.disabled) return;

    if (allowDeselect && selectedValue === option.value) {
      selectOption(null);
      return;
    }

    selectOption(option);
  }

  function handleClearClick() {
    selectOption(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement | HTMLInputElement>) {
    if (disabled || readOnly) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!opened) {
        setOpened(true);
        return;
      }

      setHighlightedIndex((current) =>
        getNextEnabledIndex(filteredOptions, current, 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (!opened) {
        setOpened(true);
        return;
      }

      setHighlightedIndex((current) =>
        getNextEnabledIndex(filteredOptions, current < 0 ? 0 : current, -1),
      );
      return;
    }

    if (event.key === "Enter") {
      if (!opened) {
        event.preventDefault();
        setOpened(true);
        return;
      }

      if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        event.preventDefault();
        handleOptionClick(filteredOptions[highlightedIndex]);
      }
      return;
    }

    if (event.key === "Escape") {
      if (opened) {
        event.preventDefault();
        setOpened(false);
        clearSearch();
      }
      return;
    }

    if (event.key === "Tab") {
      setOpened(false);
    }
  }

  const iconWidthValue = icon ? resolveCssValue(iconWidth) : "0px";
  const leftWidthValue =
    icon && iconPosition === "left" ? iconWidthValue : "0px";
  const rightWidthValue =
    icon && iconPosition === "right" ? iconWidthValue : "0px";
  const dropdownMaxHeight = resolveCssValue(maxDropdownHeight);

  const rootStyle = {
    "--select-left-section-width": leftWidthValue,
    "--select-radius": resolveRadius(radius),
    "--select-right-section-width": rightWidthValue,
    "--select-dropdown-max-height": dropdownMaxHeight,
    ...style,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={cx(
        styles.root,
        styles[`size-${size}`],
        styles[`position-${dropdownPosition}`],
        opened && styles.opened,
        !!error && styles.hasError,
        disabled && styles.disabled,
        readOnly && styles.readOnly,
        className,
      )}
      style={rootStyle}
    >
      {label ? (
        <label htmlFor={inputId} className={styles.label}>
          {label}
          {(withAsterisk || required) && <span className={styles.required}> *</span>}
        </label>
      ) : null}

      {description ? <p className={styles.description}>{description}</p> : null}

      <div className={styles.inputWrapper}>
        {icon && iconPosition === "left" ? (
          <div className={styles.leftSection}>{icon}</div>
        ) : null}

        <button
          id={inputId}
          type="button"
          disabled={disabled}
          role="combobox"
          aria-expanded={opened}
          aria-controls={`${inputId}-options`}
          aria-haspopup="listbox"
          aria-disabled={disabled}
          aria-readonly={readOnly || undefined}
          className={styles.trigger}
          onClick={() => {
            if (disabled || readOnly) return;
            setOpened((current) => !current);
          }}
          onKeyDown={handleKeyDown}
        >
          <span className={selectedOption ? styles.value : styles.placeholder}>
            {selectedOption?.label ?? placeholder}
          </span>
        </button>

        <div className={styles.controls}>
          {icon && iconPosition === "right" ? (
            <span className={styles.customRightSection}>{icon}</span>
          ) : null}
          {canClear ? (
            <button
              type="button"
              className={styles.clearButton}
              onClick={(event) => {
                event.stopPropagation();
                handleClearClick();
              }}
              aria-label="Clear selected value"
            >
              ×
            </button>
          ) : null}
          <img className={styles.chevron} alt="" src="/icons/chevron.svg" />
        </div>

        <div id={`${inputId}-options`} role="listbox" className={styles.dropdown}>
          {searchable ? (
            <div className={styles.searchWrapper}>
              <span className={styles.searchIcon}>
                <SearchLg size={18} />
              </span>
              <input
                ref={searchInputRef}
                className={styles.searchInput}
                value={resolvedSearch}
                disabled={disabled}
                readOnly={readOnly}
                onChange={(event) => updateSearch(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
              />
              {resolvedSearch ? (
                <button
                  type="button"
                  className={styles.searchClearButton}
                  onClick={() => clearSearch()}
                  aria-label="Clear search"
                >
                  ×
                </button>
              ) : null}
            </div>
          ) : null}

          <div
            className={styles.options}
            onMouseLeave={() => setHighlightedIndex(-1)}
          >
            {filteredOptions.length ? (
              filteredOptions.map((option, index) => {
                const isSelected = selectedValue === option.value;
                const isHighlighted = highlightedIndex === index;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    className={cx(
                      styles.option,
                      isSelected && styles.optionSelected,
                      isHighlighted && styles.optionHighlighted,
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleOptionClick(option)}
                  >
                    {checkIconPosition === "left" ? (
                      <span className={styles.checkIcon}>{isSelected ? <Check size={20} /> : null}</span>
                    ) : null}
                    <span className={styles.optionLabel}>{option.label}</span>
                    {checkIconPosition === "right" ? (
                      <span className={styles.checkIcon}>{isSelected ? <Check size={20} /> : null}</span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className={styles.empty}>{nothingFoundMessage}</div>
            )}
          </div>
        </div>
      </div>

      {name ? <input type="hidden" name={name} value={selectedValue ?? ""} /> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}

export default memo(Select);
