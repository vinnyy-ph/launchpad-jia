"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import { Field } from "@/lib/components/ui";
import {
  LOGO_FORMATS,
  buildFaviconUrl,
  buildLogoUrl,
  normalizeDomain,
} from "./logoUrls";
import type { Suggestion } from "./fetchers";
import styles from "../manual-profile.module.scss";

type IconComponent = ComponentType<{
  width?: number;
  height?: number;
  className?: string;
}>;

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

// Logo badge rendered inside the input (left section) and in each suggestion row.
// Walks logo.dev (webp -> png -> jpg) -> Brandfetch CDN -> Google favicon -> icon.
function LogoBadge({
  name,
  domain,
  logoUrl,
  fallbackIcon: FallbackIcon,
}: {
  name: string;
  domain: string;
  logoUrl?: string;
  fallbackIcon: IconComponent;
}) {
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [useFavicon, setUseFavicon] = useState(false);
  const [useFallbackIcon, setUseFallbackIcon] = useState(false);

  useEffect(() => {
    setAttemptIndex(0);
    setUseFavicon(false);
    setUseFallbackIcon(false);
  }, [domain, logoUrl, name]);

  const normalizedDomain = normalizeDomain(domain);
  const preferredUrl =
    logoUrl && logoUrl.trim().length > 0
      ? logoUrl
      : buildLogoUrl(normalizedDomain, LOGO_FORMATS[0]);
  const currentLogoUrl =
    attemptIndex === 0 && preferredUrl
      ? preferredUrl
      : buildLogoUrl(
          normalizedDomain,
          LOGO_FORMATS[Math.min(attemptIndex, LOGO_FORMATS.length - 1)],
        );
  const fallbackFavicon = buildFaviconUrl(normalizedDomain);
  const displayUrl = useFavicon ? fallbackFavicon : currentLogoUrl;

  return (
    <span className={styles.acLogoWrap}>
      {!useFallbackIcon && displayUrl ? (
        <img
          src={displayUrl}
          alt=""
          width={18}
          height={18}
          loading="lazy"
          decoding="async"
          className={styles.acLogoImg}
          onError={() => {
            if (
              !useFavicon &&
              normalizedDomain &&
              attemptIndex < LOGO_FORMATS.length - 1
            ) {
              setAttemptIndex((prev) => prev + 1);
              return;
            }
            if (!useFavicon && fallbackFavicon && currentLogoUrl) {
              setUseFavicon(true);
              return;
            }
            setUseFallbackIcon(true);
          }}
        />
      ) : (
        <FallbackIcon width={16} height={16} className={styles.acLogoIcon} />
      )}
    </span>
  );
}

export interface AutocompleteFieldProps {
  label: string;
  placeholder: string;
  withAsterisk?: boolean;
  value: string;
  domain?: string;
  logoUrl?: string;
  error?: string;
  onFieldBlur?: () => void;
  /** Free typing — caller should clear the stored domain + logo. */
  onTextChange: (name: string) => void;
  onSelect: (selection: { name: string; domain: string; logoUrl: string }) => void;
  fetcher: (query: string, signal: AbortSignal) => Promise<Suggestion[]>;
  fallbackIcon: IconComponent;
  showMeta?: boolean;
  loadingLabel?: string;
  emptyLabel?: string;
  /** Forwarded to the wrapper so `Group grow` can size the field (flex/maxWidth). */
  style?: CSSProperties;
}

// Shared search-with-logo input used by the inline experience / education /
// certification forms — the inline counterpart of the edit-CV overlay modals.
export default function AutocompleteField({
  label,
  placeholder,
  withAsterisk,
  value,
  domain,
  logoUrl,
  error,
  onFieldBlur,
  onTextChange,
  onSelect,
  fetcher,
  fallbackIcon,
  showMeta = false,
  loadingLabel = "Searching...",
  emptyLabel = "No results found.",
  style,
}: AutocompleteFieldProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  // A picked entry arrives with a domain — start locked so we don't re-search it.
  const [isLocked, setIsLocked] = useState(Boolean(domain));

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
        const name = (err as Error)?.name;
        if (name !== "AbortError" && name !== "CanceledError") {
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
        section={
          <LogoBadge
            name={value}
            domain={domain || ""}
            logoUrl={logoUrl}
            fallbackIcon={fallbackIcon}
          />
        }
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
            <div className={styles.acDropdownState}>{loadingLabel}</div>
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
              <button
                key={suggestion.key}
                type="button"
                className={styles.acSuggestion}
                onClick={() => {
                  onSelect({
                    name: suggestion.name,
                    domain: suggestion.domain,
                    logoUrl: suggestion.logoUrl || buildLogoUrl(suggestion.domain, "webp"),
                  });
                  setIsLocked(true);
                  setIsOpen(false);
                }}
              >
                <LogoBadge
                  name={suggestion.name}
                  domain={suggestion.domain}
                  logoUrl={suggestion.logoUrl}
                  fallbackIcon={fallbackIcon}
                />
                <span className={styles.acSuggestionText}>
                  <span className={styles.acSuggestionName}>{suggestion.name}</span>
                  {showMeta && suggestion.meta ? (
                    <span className={styles.acSuggestionMeta}>{suggestion.meta}</span>
                  ) : null}
                </span>
              </button>
            ))
          ) : (
            <div className={styles.acDropdownState}>{emptyLabel}</div>
          )}
        </div>
      )}
    </div>
  );
}
