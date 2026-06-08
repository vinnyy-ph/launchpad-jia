"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { MarkerPin01 } from "@untitledui/icons";
import { Field } from "@/lib/components/ui";
import { searchAddresses, type AddressSuggestion } from "./fetchers";
import styles from "../manual-profile.module.scss";

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

export interface AddressAutocompleteFieldProps {
  label: string;
  placeholder: string;
  withAsterisk?: boolean;
  value: string;
  error?: string;
  onFieldBlur?: () => void;
  /** Free typing. */
  onTextChange: (address: string) => void;
  onSelect: (address: string) => void;
  fetcher?: (query: string, signal: AbortSignal) => Promise<AddressSuggestion[]>;
  /** Forwarded to the wrapper so `Group grow` can size the field. */
  style?: CSSProperties;
}

// Inline address search (Photon / Komoot) — the inline counterpart of the
// edit-CV contact modal's address autocomplete. Plain location rows, no logo.
export default function AddressAutocompleteField({
  label,
  placeholder,
  withAsterisk,
  value,
  error,
  onFieldBlur,
  onTextChange,
  onSelect,
  fetcher = searchAddresses,
  style,
}: AddressAutocompleteFieldProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (!isFocused || isLocked) return;

    const query = value.trim();
    if (query.length < MIN_QUERY) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await fetcher(query, controller.signal);
        setSuggestions(results);
        setIsOpen(true);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          setSuggestions([]);
          setIsOpen(false);
        }
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [value, isFocused, isLocked, fetcher]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={styles.autocomplete} ref={wrapRef} style={style}>
      <Field
        label={label}
        withAsterisk={withAsterisk}
        size="sm"
        placeholder={placeholder}
        value={value}
        error={error}
        section={<MarkerPin01 width={18} height={18} color="#717680" />}
        sectionPosition="left"
        onFocus={() => {
          setIsFocused(true);
          if (
            !isLocked &&
            suggestions.length > 0 &&
            value.trim().length >= MIN_QUERY
          ) {
            setIsOpen(true);
          }
        }}
        onBlur={() => onFieldBlur?.()}
        onChange={(event) => {
          setIsLocked(false);
          onTextChange(event.target.value);
        }}
      />
      {isOpen && (
        <div className={styles.acDropdown}>
          {isLoading ? (
            <div className={styles.acDropdownState}>Searching locations...</div>
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                className={styles.acSuggestion}
                onClick={() => {
                  onSelect(suggestion.displayName);
                  setIsLocked(true);
                  setIsOpen(false);
                }}
              >
                <span className={styles.acSuggestionFull}>{suggestion.displayName}</span>
              </button>
            ))
          ) : (
            <div className={styles.acDropdownState}>No locations found.</div>
          )}
        </div>
      )}
    </div>
  );
}
