"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";

interface LocationResultItem {
  id?: string;
  name: string;
  count: number;
  region?: string; // e.g., "Metro Manila, PH"
}

interface LocationDropdownData {
  locations: LocationResultItem[];
}

export interface LocationDropdownProps {
  /**
   * Whether the dropdown is visible
   */
  isVisible: boolean;
  
  /**
   * Reference to the wrapper element to position the dropdown below it and match its width
   */
  wrapperRef?: React.RefObject<HTMLDivElement>;
  
  /**
   * External ref for the dropdown container (for click-outside detection)
   */
  dropdownRef?: React.RefObject<HTMLDivElement>;
  
  /**
   * Current search query value
   */
  searchQuery?: string;
  
  /**
   * Location data aggregated from real candidates
   */
  locationData?: LocationDropdownData;
  
  /**
   * Whether location suggestions are currently loading
   */
  isLoading?: boolean;
  
  /**
   * Custom className for the dropdown container
   */
  className?: string;
  
  /**
   * Callback when mouse enters the dropdown
   */
  onMouseEnter?: () => void;
  
  /**
   * Callback when mouse leaves the dropdown
   */
  onMouseLeave?: () => void;
  
  /**
   * Callback when a location result item is selected
   * Receives the location name, and internally handles the "Location" type
   */
  onItemSelect?: (type: "Location", name: string) => void;
  
  /**
   * Custom z-index for the dropdown (default: 1000)
   */
  zIndex?: number;
}

/**
 * Helper function to highlight matching text in search results
 * Returns JSX with matching text underlined
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.trim().length === 0) {
    return text;
  }

  const queryLower = query.toLowerCase().trim();
  const textLower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let index = textLower.indexOf(queryLower, lastIndex);

  // If no match found, return original text
  if (index === -1) {
    return text;
  }

  while (index !== -1) {
    // Add text before the match
    if (index > lastIndex) {
      parts.push(text.substring(lastIndex, index));
    }
    
    // Add the matched text with underline (use original text casing)
    parts.push(
      <span 
        key={`match-${index}`}
        style={{
          textDecoration: "none",
          borderBottom: "2px solid var(--Text-text-primary, #181D27)",
          paddingBottom: "1px",
          fontWeight: 700,
          color: "var(--Text-text-primary, #181D27)",
        }}
      >
        {text.substring(index, index + query.length)}
      </span>
    );
    
    lastIndex = index + query.length;
    index = textLower.indexOf(queryLower, lastIndex);
  }

  // Add remaining text after the last match
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

/**
 * LocationDropdown component that displays below the Location input field when focused.
 * Contains search results.
 */
export default function LocationDropdown({
  isVisible,
  wrapperRef,
  dropdownRef: externalDropdownRef,
  searchQuery = "",
  locationData,
  isLoading = false,
  className = "",
  onMouseEnter,
  onMouseLeave,
  onItemSelect,
  zIndex = 1000,
}: LocationDropdownProps) {
  const internalDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRef = externalDropdownRef || internalDropdownRef;
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  const normalizedData = useMemo<LocationDropdownData>(() => ({
    locations: locationData?.locations ?? [],
  }), [locationData]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const hasSearchQuery = normalizedQuery.length > 0;

  const filteredLocations = useMemo(() => {
    if (!hasSearchQuery) return [];
    return normalizedData.locations.filter(item => 
      item.name?.toLowerCase().includes(normalizedQuery) ||
      item.region?.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedData.locations, normalizedQuery, hasSearchQuery]);

  const hasResults = filteredLocations.length > 0;

  useEffect(() => {
    if (isVisible && wrapperRef?.current) {
      const updatePosition = () => {
        if (wrapperRef?.current) {
          const wrapperRect = wrapperRef.current.getBoundingClientRect();
          const scrollY = window.scrollY;
          const scrollX = window.scrollX;
          
          setPosition({
            top: wrapperRect.bottom + scrollY + 8, // 8px gap below wrapper
            left: wrapperRect.left + scrollX,
            width: wrapperRect.width,
          });
        }
      };

      updatePosition();
      
      // Update on scroll/resize to keep it positioned correctly
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [isVisible, wrapperRef]);

  if (!isVisible) {
    return null;
  }

  // Don't show dropdown if there's no search query
  if (!hasSearchQuery) {
    return null;
  }

  return (
    <>
      <div
        ref={dropdownRef}
        className={className}
        style={{
          position: "fixed",
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: `${position.width}px`,
          zIndex: zIndex,
          boxSizing: "border-box",
          height: "fit-content",
          borderRadius: "8px",
          border: "1px solid #F5F5F5",
          background: "#FFFFFF",
          boxShadow: "0px 24px 48px -12px #0A0D122E",
          display: "flex",
          flexDirection: "column",
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* Search Results Section - Show when there's a search query */}
        {hasSearchQuery && (
          <>
            <div
              style={{
                width: "100%",
                height: "fit-content",
                gap: "8px",
                paddingTop: "12px",
                paddingRight: "16px",
                paddingBottom: "12px",
                paddingLeft: "16px",
                display: "flex",
                flexDirection: "column",
                maxHeight: "400px",
                overflowY: "auto",
                scrollbarWidth: "thin",
                scrollbarColor: "var(--Colors-Primary_Colors-Neutrals-200, #E9EAEB) transparent",
              }}
            >
              <div
                style={{
                  fontWeight: 500,
                  fontSize: "14px",
                  lineHeight: "20px",
                  letterSpacing: 0,
                  color: "var(--Text-text-placeholder, #A4A7AE)",
                }}
              >
                Search Results
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  width: "100%",
                }}
              >
                {filteredLocations.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0,
                        width: "100%",
                      }}
                    >
                      {filteredLocations.map((location, index) => (
                        <div
                          key={`location-${index}`}
                          onClick={() => onItemSelect?.("Location", location.name)}
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            width: "100%",
                            cursor: "pointer",
                            boxSizing: "border-box",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "row",
                              alignItems: "center",
                              gap: "12px",
                              width: "fit-content",
                              paddingTop: "4px",
                              paddingBottom: "4px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: "8px",
                                width: "fit-content",
                              }}
                            >
                              <div
                                style={{
                                  width: "20px",
                                  height: "20px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                <img src="/iconsV3/map-pinV2.svg" alt="Location" width={17} height={20} style={{ display: "block" }} />
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: "8px",
                                  flex: 1,
                                  minWidth: 0,
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 500,
                                    fontSize: "14px",
                                    lineHeight: "20px",
                                    letterSpacing: 0,
                                    color: "var(--Text-text-secondary, #414651)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {highlightMatch(location.name, searchQuery)}
                                </span>
                                {location.region && location.region.trim() && (
                                  <span
                                    style={{
                                      fontWeight: 500,
                                      fontStyle: "normal",
                                      fontSize: "12px",
                                      lineHeight: "18px",
                                      letterSpacing: "0%",
                                      color: "var(--Text-text-placeholder, #A4A7AE)",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {location.region}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "row",
                              alignItems: "center",
                              gap: "8px",
                              flexShrink: 0,
                              paddingTop: "4px",
                              paddingBottom: "4px",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 500,
                                fontSize: "12px",
                                lineHeight: "18px",
                                letterSpacing: 0,
                                color: "var(--Text-text-tertiary, #717680)",
                              }}
                            >
                              {location.count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!hasResults && (
                  <div
                    style={{
                      width: "100%",
                      fontWeight: 500,
                      fontSize: "14px",
                      lineHeight: "20px",
                      letterSpacing: 0,
                      color: "var(--Text-text-placeholder, #A4A7AE)",
                      paddingTop: "8px",
                    }}
                  >
                    {isLoading ? "Loading..." : "No search results found"}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

