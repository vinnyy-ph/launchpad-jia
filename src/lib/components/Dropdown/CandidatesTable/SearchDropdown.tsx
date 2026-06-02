"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";

interface SearchResultItem {
  id?: string;
  name: string;
  email?: string;
  count: number;
}

interface SearchDropdownData {
  candidates: SearchResultItem[];
  skills: SearchResultItem[];
  positions: SearchResultItem[];
}

export interface RecentSearch {
  type: "Candidates" | "Skills" | "Current Position" | "Location";
  name: string;
  timestamp: number;
}

const RECENT_SEARCHES_STORAGE_KEY = "candidates-table-recent-searches";
const MAX_RECENT_SEARCHES = 5;
const MAX_SUGGESTED_ITEMS = 5;

// Local storage utilities for recent searches
export const getRecentSearches = (): RecentSearch[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!stored) return [];
    const searches = JSON.parse(stored) as RecentSearch[];
    // Sort by timestamp (most recent first) and limit to MAX_RECENT_SEARCHES
    return searches
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch (error) {
    console.error("Error loading recent searches:", error);
    return [];
  }
};

export const saveRecentSearch = (type: "Candidates" | "Skills" | "Current Position" | "Location", name: string): void => {
  if (typeof window === "undefined") return;
  try {
    const searches = getRecentSearches();
    // Remove duplicate if exists (will be re-added at the top)
    const filtered = searches.filter(
      (s) => !(s.type === type && s.name.toLowerCase() === name.toLowerCase())
    );
    // Add new search at the beginning
    const updated = [
      { type, name, timestamp: Date.now() },
      ...filtered,
    ].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
    // Dispatch custom event so useLocalStorage hook can pick up the change
    window.dispatchEvent(new CustomEvent('localStorageChange', {
      detail: { key: RECENT_SEARCHES_STORAGE_KEY, value: updated }
    }));
  } catch (error) {
    console.error("Error saving recent search:", error);
  }
};

export const removeRecentSearch = (type: "Candidates" | "Skills" | "Current Position" | "Location", name: string): void => {
  if (typeof window === "undefined") return;
  try {
    const searches = getRecentSearches();
    const filtered = searches.filter(
      (s) => !(s.type === type && s.name.toLowerCase() === name.toLowerCase())
    );
    localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(filtered));
    // Dispatch custom event so useLocalStorage hook can pick up the change
    window.dispatchEvent(new CustomEvent('localStorageChange', {
      detail: { key: RECENT_SEARCHES_STORAGE_KEY, value: filtered }
    }));
  } catch (error) {
    console.error("Error removing recent search:", error);
  }
};

export const clearAllRecentSearches = (): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    // Dispatch custom event so useLocalStorage hook can pick up the change
    window.dispatchEvent(new CustomEvent('localStorageChange', {
      detail: { key: RECENT_SEARCHES_STORAGE_KEY, value: [] }
    }));
  } catch (error) {
    console.error("Error clearing recent searches:", error);
  }
};

export interface SearchDropdownProps {
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
   * Search data aggregated from real candidates
   */
  searchData?: SearchDropdownData;
  
  /**
   * Whether search suggestions are currently loading
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
   * Callback when a search result item is selected
   */
  onItemSelect?: (type: "Candidates" | "Skills" | "Current Position" | "Location", name: string) => void;
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
 * SearchDropdown component that displays below the Search input field when focused.
 * Contains filter buttons, recent searches, and suggested searches.
 */
export default function SearchDropdown({
  isVisible,
  wrapperRef,
  dropdownRef: externalDropdownRef,
  searchQuery = "",
  searchData,
  isLoading = false,
  className = "",
  onMouseEnter,
  onMouseLeave,
  onItemSelect,
}: SearchDropdownProps) {
  const internalDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRef = externalDropdownRef || internalDropdownRef;
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const [selectedFilter, setSelectedFilter] = useState<"Candidates" | "Skills" | "Current Position" | null>(null);
  
  // Use useLocalStorage hook for recent searches with automatic sync
  const [storedRecentSearches, setStoredRecentSearches] = useLocalStorage<RecentSearch[]>(
    RECENT_SEARCHES_STORAGE_KEY,
    []
  );
  
  // Process and sort recent searches (most recent first, limit to MAX_RECENT_SEARCHES)
  const recentSearches = useMemo(() => {
    return storedRecentSearches
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_RECENT_SEARCHES);
  }, [storedRecentSearches]);

  const normalizedData = useMemo<SearchDropdownData>(() => ({
    candidates: searchData?.candidates ?? [],
    skills: searchData?.skills ?? [],
    positions: searchData?.positions ?? [],
  }), [searchData]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const hasSearchQuery = normalizedQuery.length > 0;

  const filteredCandidates = useMemo(() => {
    if (!hasSearchQuery) return [];
    return normalizedData.candidates.filter(item => 
      item.name?.toLowerCase().includes(normalizedQuery) || 
      item.email?.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedData.candidates, normalizedQuery, hasSearchQuery]);

  const filteredSkills = useMemo(() => {
    if (!hasSearchQuery) return [];
    return normalizedData.skills.filter(item => item.name?.toLowerCase().includes(normalizedQuery));
  }, [normalizedData.skills, normalizedQuery, hasSearchQuery]);

  const filteredPositions = useMemo(() => {
    if (!hasSearchQuery) return [];
    return normalizedData.positions.filter(item => item.name?.toLowerCase().includes(normalizedQuery));
  }, [normalizedData.positions, normalizedQuery, hasSearchQuery]);

  const searchResults = useMemo(() => ({
    candidates: filteredCandidates,
    skills: filteredSkills,
    positions: filteredPositions,
  }), [filteredCandidates, filteredSkills, filteredPositions]);

  const hasResults = searchResults.candidates.length > 0 || searchResults.skills.length > 0 || searchResults.positions.length > 0;

  const handleFilterSelect = (filter: "Candidates" | "Skills" | "Current Position") => {
    setSelectedFilter((prev) => (prev === filter ? null : filter));
  };

  // Recent searches are now automatically synced via useLocalStorage hook
  // No need for manual loading - the hook handles it

  const handleRecentSearchClick = (type: "Candidates" | "Skills" | "Current Position" | "Location", name: string) => {
    onItemSelect?.(type, name);
  };

  const handleDeleteRecentSearch = (e: React.MouseEvent, type: "Candidates" | "Skills" | "Current Position" | "Location", name: string) => {
    e.stopPropagation();
    // Use the hook's setter to remove the search
    setStoredRecentSearches((prev) =>
      prev.filter(
        (s) => !(s.type === type && s.name.toLowerCase() === name.toLowerCase())
      )
    );
  };

  const handleClearAllRecentSearches = () => {
    // Use the hook's setter to clear all searches
    setStoredRecentSearches([]);
  };

  // Generate suggested items from most popular items, excluding recent searches
  const suggestedItems = useMemo(() => {
    const recentSearchSet = new Set(
      recentSearches.map(s => `${s.type}:${s.name.toLowerCase()}`)
    );
    
    const suggestions: Array<{ type: "Candidates" | "Skills" | "Current Position"; name: string; count: number }> = [];
    
    // Get top items from each category (sorted by count, highest first)
    // Exclude items that are in recent searches
    const topSkills = normalizedData.skills
      .filter(item => !recentSearchSet.has(`Skills:${item.name.toLowerCase()}`))
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .map(item => ({ type: "Skills" as const, name: item.name, count: item.count }));
    
    const topPositions = normalizedData.positions
      .filter(item => !recentSearchSet.has(`Current Position:${item.name.toLowerCase()}`))
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .map(item => ({ type: "Current Position" as const, name: item.name, count: item.count }));
    
    const topCandidates = normalizedData.candidates
      .filter(item => !recentSearchSet.has(`Candidates:${item.name.toLowerCase()}`))
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .map(item => ({ type: "Candidates" as const, name: item.name, count: item.count }));
    
    // Combine and sort by count, then limit to MAX_SUGGESTED_ITEMS
    suggestions.push(...topSkills, ...topPositions, ...topCandidates);
    return suggestions
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_SUGGESTED_ITEMS);
  }, [normalizedData, recentSearches]);

  const handleSuggestedItemClick = (type: "Candidates" | "Skills" | "Current Position", name: string) => {
    onItemSelect?.(type, name);
  };

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
          zIndex: 1000,
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
        {/* Filter Buttons Section */}
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
            I'm searching for...
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => handleFilterSelect("Candidates")}
              style={{
                borderRadius: "999px",
                gap: "8px",
                paddingTop: "8px",
                paddingRight: "14px",
                paddingBottom: "8px",
                paddingLeft: "14px",
                border: selectedFilter === "Candidates" ? "1px solid var(--Button-bg-primary, #181D27)" : "1px solid var(--Button-border-primary, #D5D7DA)",
                background: selectedFilter === "Candidates" ? "var(--Button-bg-primary, #181D27)" : "var(--Button-bg-secondary, #FFFFFF)",
                boxShadow: selectedFilter === "Candidates" ? "0px 1px 2px 0px #0A0D120D" : "none",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                cursor: "pointer",
                boxSizing: "border-box",
                textDecoration: "none",
                outline: "none",
                position: "relative",
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = "none";
                e.currentTarget.style.textDecoration = "none";
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.outline = "none";
                e.currentTarget.style.textDecoration = "none";
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src="/iconsV3/user-group.svg"
                  alt="Candidates"
                  width={20}
                  height={17}
                  style={{
                    display: "block",
                    filter: selectedFilter === "Candidates" ? "brightness(0) saturate(100%) invert(100%) sepia(0%) saturate(7497%) hue-rotate(28deg) brightness(109%) contrast(105%)" : "none",
                  }}
                />
              </div>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "14px",
                  lineHeight: "20px",
                  letterSpacing: 0,
                  color: selectedFilter === "Candidates" ? "#FFFFFF" : "var(--Button-text-secondary, #414651)",
                }}
              >
                Candidates
              </span>
              {selectedFilter === "Candidates" && (
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: "4px",
                  }}
                >
                  <img src="/iconsV3/checkV8.svg" alt="Selected" width={15} height={11} />
                </div>
              )}
            </button>
            <button
              onClick={() => handleFilterSelect("Skills")}
              style={{
                borderRadius: "999px",
                gap: "8px",
                paddingTop: "8px",
                paddingRight: "14px",
                paddingBottom: "8px",
                paddingLeft: "14px",
                border: selectedFilter === "Skills" ? "1px solid var(--Button-bg-primary, #181D27)" : "1px solid var(--Button-border-primary, #D5D7DA)",
                background: selectedFilter === "Skills" ? "var(--Button-bg-primary, #181D27)" : "var(--Button-bg-secondary, #FFFFFF)",
                boxShadow: selectedFilter === "Skills" ? "0px 1px 2px 0px #0A0D120D" : "none",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                cursor: "pointer",
                boxSizing: "border-box",
                textDecoration: "none",
                outline: "none",
                position: "relative",
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = "none";
                e.currentTarget.style.textDecoration = "none";
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.outline = "none";
                e.currentTarget.style.textDecoration = "none";
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src="/iconsV3/skills.svg"
                  alt="Skills"
                  width={17}
                  height={16}
                  style={{
                    display: "block",
                    filter: selectedFilter === "Skills" ? "brightness(0) saturate(100%) invert(100%) sepia(0%) saturate(7497%) hue-rotate(28deg) brightness(109%) contrast(105%)" : "none",
                  }}
                />
              </div>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "14px",
                  lineHeight: "20px",
                  letterSpacing: 0,
                  color: selectedFilter === "Skills" ? "#FFFFFF" : "var(--Button-text-secondary, #414651)",
                }}
              >
                Skills
              </span>
              {selectedFilter === "Skills" && (
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: "4px",
                  }}
                >
                  <img src="/iconsV3/checkV8.svg" alt="Selected" width={15} height={11} />
                </div>
              )}
            </button>
            <button
              onClick={() => handleFilterSelect("Current Position")}
              style={{
                borderRadius: "999px",
                gap: "8px",
                paddingTop: "8px",
                paddingRight: "14px",
                paddingBottom: "8px",
                paddingLeft: "14px",
                border: selectedFilter === "Current Position" ? "1px solid var(--Button-bg-primary, #181D27)" : "1px solid var(--Button-border-primary, #D5D7DA)",
                background: selectedFilter === "Current Position" ? "var(--Button-bg-primary, #181D27)" : "var(--Button-bg-secondary, #FFFFFF)",
                boxShadow: selectedFilter === "Current Position" ? "0px 1px 2px 0px #0A0D120D" : "none",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                cursor: "pointer",
                boxSizing: "border-box",
                textDecoration: "none",
                outline: "none",
                position: "relative",
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = "none";
                e.currentTarget.style.textDecoration = "none";
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.outline = "none";
                e.currentTarget.style.textDecoration = "none";
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src="/iconsV3/id.svg"
                  alt="Current Position"
                  width={17}
                  height={17}
                  style={{
                    display: "block",
                    filter: selectedFilter === "Current Position" ? "brightness(0) saturate(100%) invert(100%) sepia(0%) saturate(7497%) hue-rotate(28deg) brightness(109%) contrast(105%)" : "none",
                  }}
                />
              </div>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "14px",
                  lineHeight: "20px",
                  letterSpacing: 0,
                  color: selectedFilter === "Current Position" ? "#FFFFFF" : "var(--Button-text-secondary, #414651)",
                }}
              >
                Current Position
              </span>
              {selectedFilter === "Current Position" && (
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: "4px",
                  }}
                >
                  <img src="/iconsV3/checkV8.svg" alt="Selected" width={15} height={11} />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Search Results Section - Show when there's a search query */}
        {hasSearchQuery && (
          <>
            <div
              style={{
                width: "100%",
                height: "1px",
                background: "#F5F5F5",
              }}
            ></div>
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
                {/* Candidates Results */}
                {(!selectedFilter || selectedFilter === "Candidates") && searchResults.candidates.length > 0 && (
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
                        fontWeight: 700,
                        fontSize: "14px",
                        lineHeight: "20px",
                        letterSpacing: 0,
                        color: "var(--Text-text-secondary, #414651)",
                      }}
                    >
                      Candidates
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0,
                        width: "100%",
                      }}
                    >
                      {searchResults.candidates.map((candidate, index) => (
                        <div
                          key={`candidate-${index}`}
                          onClick={() => onItemSelect?.("Candidates", candidate.name)}
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
                                <img src="/iconsV3/user-candidate.svg" alt="Candidate" width={14} height={14} style={{ display: "block" }} />
                              </div>
                              <span
                                style={{
                                  fontWeight: 500,
                                  fontSize: "14px",
                                  lineHeight: "20px",
                                  letterSpacing: 0,
                                  color: "var(--Text-text-secondary, #414651)",
                                }}
                              >
                                {highlightMatch(candidate.name, searchQuery)}
                                {candidate.email && candidate.email.toLowerCase().includes(normalizedQuery) && !candidate.name.toLowerCase().includes(normalizedQuery) && (
                                  <span style={{ fontWeight: 400, color: "var(--Text-text-placeholder, #A4A7AE)", marginLeft: "4px" }}>
                                    ({highlightMatch(candidate.email, searchQuery)})
                                  </span>
                                )}
                              </span>
                            </div>
                            <span
                              style={{
                                fontWeight: 500,
                                fontSize: "12px",
                                lineHeight: "18px",
                                letterSpacing: 0,
                                color: "var(--Text-text-placeholder, #A4A7AE)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Candidate
                            </span>
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
                              {candidate.count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills Results */}
                {(!selectedFilter || selectedFilter === "Skills") && searchResults.skills.length > 0 && (
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
                        fontWeight: 700,
                        fontSize: "14px",
                        lineHeight: "20px",
                        letterSpacing: 0,
                        color: "var(--Text-text-secondary, #414651)",
                      }}
                    >
                      Skills
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0,
                        width: "100%",
                      }}
                    >
                      {searchResults.skills.map((skill, index) => (
                        <div
                          key={`skill-${index}`}
                          onClick={() => onItemSelect?.("Skills", skill.name)}
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
                                <img
                                  src="/iconsV3/skills.svg"
                                  alt="Skill"
                                  width={17}
                                  height={16}
                                  style={{
                                    display: "block",
                                    filter: "brightness(0) saturate(100%) invert(65%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(1.1) contrast(0.9)",
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  fontWeight: 500,
                                  fontSize: "14px",
                                  lineHeight: "20px",
                                  letterSpacing: 0,
                                  color: "var(--Text-text-secondary, #414651)",
                                }}
                              >
                                {highlightMatch(skill.name, searchQuery)}
                              </span>
                            </div>
                            <span
                              style={{
                                fontWeight: 500,
                                fontSize: "12px",
                                lineHeight: "18px",
                                letterSpacing: 0,
                                color: "var(--Text-text-placeholder, #A4A7AE)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Skill
                            </span>
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
                              {skill.count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current Position Results */}
                {(!selectedFilter || selectedFilter === "Current Position") && searchResults.positions.length > 0 && (
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
                        fontWeight: 700,
                        fontSize: "14px",
                        lineHeight: "20px",
                        letterSpacing: 0,
                        color: "var(--Text-text-secondary, #414651)",
                      }}
                    >
                      Current Position
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0,
                        width: "100%",
                      }}
                    >
                      {searchResults.positions.map((position, index) => (
                        <div
                          key={`position-${index}`}
                          onClick={() => onItemSelect?.("Current Position", position.name)}
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
                                <img
                                  src="/iconsV3/id.svg"
                                  alt="Position"
                                  width={17}
                                  height={16}
                                  style={{
                                    display: "block",
                                    filter: "brightness(0) saturate(100%) invert(67%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(1) contrast(0.9)",
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  fontWeight: 500,
                                  fontSize: "14px",
                                  lineHeight: "20px",
                                  letterSpacing: 0,
                                  color: "var(--Text-text-secondary, #414651)",
                                }}
                              >
                                {highlightMatch(position.name, searchQuery)}
                              </span>
                            </div>
                            <span
                              style={{
                                fontWeight: 500,
                                fontSize: "12px",
                                lineHeight: "18px",
                                letterSpacing: 0,
                                color: "var(--Text-text-placeholder, #A4A7AE)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Current Position
                            </span>
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
                              {position.count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
                  {isLoading ? "Loading..." : (selectedFilter ? `No ${selectedFilter.toLowerCase()} found` : "No search results found")}
                </div>
              )}
            </div>
          </>
        )}

        {/* Recent Searches Section - Hide when there's a search query */}
        {!hasSearchQuery && recentSearches.length > 0 && (
          <>
            <div
              style={{
                width: "100%",
                height: "1px",
                background: "#F5F5F5",
              }}
            ></div>
            {/* Recent Searches Section */}
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
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <span
                  style={{
                    fontWeight: 500,
                    fontSize: "14px",
                    lineHeight: "20px",
                    letterSpacing: 0,
                    color: "var(--Text-text-placeholder, #A4A7AE)",
                  }}
                >
                  Recent Searches
                </span>
                <button
                  onClick={handleClearAllRecentSearches}
                  style={{
                    fontWeight: 700,
                    fontSize: "12px",
                    lineHeight: "18px",
                    letterSpacing: 0,
                    color: "var(--Colors-Secondary_Colors-Indigo-600, #444CE7)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "none",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = "none";
                    e.currentTarget.style.textDecoration = "none";
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.outline = "none";
                    e.currentTarget.style.textDecoration = "none";
                  }}
                >
                  Clear All
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                  width: "100%",
                }}
              >
                {recentSearches.map((search, index) => {
                  const typeLabel = search.type === "Candidates" ? "Candidates" : search.type === "Skills" ? "Skills" : search.type === "Current Position" ? "Current Position" : "Location";
                  return (
                    <div
                      key={`recent-${search.type}-${search.name}-${index}`}
                      onClick={() => handleRecentSearchClick(search.type, search.name)}
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
                            <img src="/iconsV3/clock-history.svg" alt="Clock" width={18} height={15} style={{ display: "block" }} />
                          </div>
                          <span
                            style={{
                              fontWeight: 500,
                              fontSize: "14px",
                              lineHeight: "20px",
                              letterSpacing: 0,
                              color: "var(--Text-text-secondary, #414651)",
                            }}
                          >
                            {search.name}
                          </span>
                        </div>
                        <div
                          style={{
                            fontWeight: 500,
                            fontSize: "12px",
                            lineHeight: "18px",
                            letterSpacing: 0,
                            color: "var(--Text-text-placeholder, #A4A7AE)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {typeLabel}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          flexShrink: 0,
                          width: "16px",
                          height: "16px",
                        }}
                      >
                        <button
                          onClick={(e) => handleDeleteRecentSearch(e, search.type, search.name)}
                          style={{
                            width: "16px",
                            height: "16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            outline: "none",
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.outline = "none";
                            e.currentTarget.style.border = "none";
                          }}
                          onMouseDown={(e) => {
                            e.currentTarget.style.outline = "none";
                            e.currentTarget.style.border = "none";
                          }}
                        >
                          <img src="/iconsV3/trashV2.svg" alt="Delete" width={14} height={15} style={{ display: "block" }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Suggested Section - Always visible */}
        {suggestedItems.length > 0 && (
          <>
            <div
              style={{
                width: "100%",
                height: "1px",
                background: "#F5F5F5",
              }}
            ></div>
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
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <span
                  style={{
                    fontWeight: 500,
                    fontSize: "14px",
                    lineHeight: "20px",
                    letterSpacing: 0,
                    color: "var(--Text-text-placeholder, #A4A7AE)",
                  }}
                >
                  Suggested
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                  width: "100%",
                }}
              >
                {suggestedItems.map((item, index) => {
                  const typeLabel = item.type === "Candidates" ? "Candidates" : item.type === "Skills" ? "Skills" : "Current Position";
                  return (
                    <div
                      key={`suggested-${item.type}-${item.name}-${index}`}
                      onClick={() => handleSuggestedItemClick(item.type, item.name)}
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
                            <img src="/iconsV3/search.svg" alt="Search" width={20} height={20} style={{ display: "block" }} />
                          </div>
                          <span
                            style={{
                              fontWeight: 500,
                              fontSize: "14px",
                              lineHeight: "20px",
                              letterSpacing: 0,
                              color: "var(--Text-text-secondary, #414651)",
                            }}
                          >
                            {item.name}
                          </span>
                        </div>
                        <div
                          style={{
                            fontWeight: 500,
                            fontSize: "12px",
                            lineHeight: "18px",
                            letterSpacing: 0,
                            color: "var(--Text-text-placeholder, #A4A7AE)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {typeLabel}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

