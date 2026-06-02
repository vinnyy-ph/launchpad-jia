"use client";
import React, { useState, useRef, useEffect, useMemo } from "react";
import LocationDropdown from "../Dropdown/CandidatesTable/LocationDropdown";
import { useLocationSuggestions } from "@/lib/hooks/CandidatesTable/useLocationSuggestions";

interface LocationDropdownData {
    locations: Array<{ name: string; count: number; region?: string }>;
}

interface PreScreeningQuestion {
    id: string;
    questionType: string;
    question: string;
    questionFormat: string;
    answers: Array<{ id: string | number; value: string | number; type: string }>;
}

interface AdvancedFiltersPanelProps {
    orgID?: string | null;
    isOpen: boolean;
    onClose: () => void;
    locationData?: LocationDropdownData;
    minYears?: string;
    maxYears?: string;
    minSalary?: string;
    maxSalary?: string;
    preScreeningQuestions?: PreScreeningQuestion[];
    onApplyFilters?: (filters: { 
        locations: string[]; 
        minYears: string; 
        maxYears: string; 
        minSalary: string; 
        maxSalary: string; 
        availability: string; 
        workSetup: string[];
        preScreeningAnswers: Record<string, any>;
    }) => void;
}

export default function AdvancedFiltersPanel({ orgID = null, isOpen, onClose, locationData, minYears: propMinYears = "", maxYears: propMaxYears = "", minSalary: propMinSalary = "", maxSalary: propMaxSalary = "", preScreeningQuestions = [], onApplyFilters }: AdvancedFiltersPanelProps) {
    const [locationInput, setLocationInput] = useState("");
    const [isLocationDropdownVisible, setIsLocationDropdownVisible] = useState(false);
    const [focusedInput, setFocusedInput] = useState<string | null>(null);
    const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
    const [minYears, setMinYears] = useState<string>(propMinYears);
    const [maxYears, setMaxYears] = useState<string>(propMaxYears);
    
    // State for pre-screening question answers
    const [preScreeningAnswers, setPreScreeningAnswers] = useState<Record<string, any>>({});
    const [preScreeningDropdownsOpen, setPreScreeningDropdownsOpen] = useState<Record<string, boolean>>({});
    const [preScreeningDropdownPositions, setPreScreeningDropdownPositions] = useState<Record<string, { positionAbove: boolean }>>({});
    const preScreeningButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    
    const locationInputRef = useRef<HTMLInputElement>(null);
    const locationWrapperRef = useRef<HTMLDivElement>(null);
    const locationDropdownRef = useRef<HTMLDivElement>(null);
    // Scrollable content container - used as the parent for overflow calculations
    const contentAreaRef = useRef<HTMLDivElement | null>(null);

    // Mongo-backed location suggestions (all candidates in DB), debounced like Skills
    const { data: mongoLocationSuggestions, isLoading: isLoadingLocationSuggestions } = useLocationSuggestions(orgID ?? null, locationInput, 300);

    // Prefer Mongo suggestions when user is typing, otherwise fall back to provided local data
    const effectiveLocationData = useMemo<LocationDropdownData>(() => {
        if ((locationInput || "").trim().length >= 2) {
            return { locations: mongoLocationSuggestions.locations || [] };
        }
        return locationData || { locations: [] };
    }, [locationInput, mongoLocationSuggestions, locationData]);

    const handleLocationSelect = (type: "Location", name: string) => {
        if (!selectedLocations.includes(name)) {
            setSelectedLocations(prev => [...prev, name]);
        }
        setIsLocationDropdownVisible(false);
        setFocusedInput(null);
        setLocationInput("");
        if (locationInputRef.current) {
            locationInputRef.current.blur();
        }
    };

    const handleRemoveLocation = (name: string) => {
        setSelectedLocations(prev => prev.filter(loc => loc !== name));
    };

    const handleClearFilters = () => {
        setSelectedLocations([]);
        setMinYears("");
        setMaxYears("");
        setLocationInput("");
        setPreScreeningAnswers({});
        // Reset all pre-screening dropdown states
        setPreScreeningDropdownsOpen({});
    };

    const handleApplyFilters = () => {
        if (onApplyFilters) {
            // Map local pre-screening answers (keyed by uniqueKey) back to question IDs
            // IMPORTANT: Multiple careers can have questions with the same ID, so we need to
            // preserve all answers. We'll use a composite key: questionId + question text
            // to ensure uniqueness while still allowing the filter logic to work.
            const mappedPreScreeningAnswers: Record<string, any> = {};

            preScreeningQuestions.forEach((question, index) => {
                const uniqueKey = `${question.question}-${question.questionFormat}-${index}`;
                if (preScreeningAnswers.hasOwnProperty(uniqueKey)) {
                    // Use a composite key to handle duplicate question IDs across careers
                    // Format: "questionId|questionText" to ensure uniqueness
                    const compositeKey = `${question.id}|${question.question}`;
                    mappedPreScreeningAnswers[compositeKey] = preScreeningAnswers[uniqueKey];
                }
            });

            onApplyFilters({
                locations: selectedLocations,
                minYears: minYears.trim(),
                maxYears: maxYears.trim(),
                minSalary: "",
                maxSalary: "",
                availability: "",
                workSetup: [],
                preScreeningAnswers: mappedPreScreeningAnswers
            });
        }
        onClose();
    };

    // Sync minYears and maxYears with props when they change
    useEffect(() => {
        setMinYears(propMinYears);
        setMaxYears(propMaxYears);
    }, [propMinYears, propMaxYears]);

    // Close all pre-screening dropdowns when questions list changes
    useEffect(() => {
        setPreScreeningDropdownsOpen({});
        setPreScreeningDropdownPositions({});
        // We keep refs as they are re-bound by React when questions re-render
    }, [preScreeningQuestions]);

    // Close location dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!isLocationDropdownVisible && focusedInput !== "location") return;
            
            const target = event.target as HTMLElement;
            
            if (locationWrapperRef.current && locationWrapperRef.current.contains(target)) {
                return;
            }
            
            if (locationDropdownRef.current && locationDropdownRef.current.contains(target)) {
                return;
            }
            
            setIsLocationDropdownVisible(false);
            setFocusedInput(null);
            if (locationInputRef.current) {
                locationInputRef.current.blur();
            }
        };

        if (isLocationDropdownVisible || focusedInput === "location") {
            const timeoutId = setTimeout(() => {
                document.addEventListener("mousedown", handleClickOutside, true);
            }, 0);
            
            return () => {
                clearTimeout(timeoutId);
                document.removeEventListener("mousedown", handleClickOutside, true);
            };
        }
    }, [isLocationDropdownVisible, focusedInput]);


    // Close pre-screening question dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            
            // Check each open dropdown
            Object.keys(preScreeningDropdownsOpen).forEach((uniqueKey) => {
                if (!preScreeningDropdownsOpen[uniqueKey]) return;
                
                const buttonRef = preScreeningButtonRefs.current[uniqueKey];
                if (buttonRef && buttonRef.contains(target)) {
                    return; // Click is on button, let it handle toggle
                }
                
                // Check if click is outside the dropdown
                const dropdownElement = document.querySelector(`[data-prescreening-dropdown="${uniqueKey}"]`);
                if (dropdownElement && dropdownElement.contains(target)) {
                    return; // Click is inside dropdown
                }
                
                // Close this dropdown
                setPreScreeningDropdownsOpen(prev => ({ ...prev, [uniqueKey]: false }));
            });
        };

        const hasOpenDropdowns = Object.values(preScreeningDropdownsOpen).some(open => open);
        if (hasOpenDropdowns) {
            const timeoutId = setTimeout(() => {
                document.addEventListener("mousedown", handleClickOutside, true);
            }, 0);
            
            return () => {
                clearTimeout(timeoutId);
                document.removeEventListener("mousedown", handleClickOutside, true);
            };
        }
    }, [preScreeningDropdownsOpen]);

    // Build display filters for tags
    const displayFilters = useMemo(() => {
        const filters: Array<{ type: "Location" | "Experience"; name: string }> = [];
        
        selectedLocations.forEach(loc => {
            filters.push({ type: "Location", name: loc });
        });
        
        if (minYears.trim() || maxYears.trim()) {
            const min = minYears.trim();
            const max = maxYears.trim();
            let filterName = "";
            
            if (min && max) {
                filterName = `${min}-${max} years`;
            } else if (min) {
                filterName = `${min}≥ years`;
            } else if (max) {
                filterName = `${max}≤ years`;
            }
            
            if (filterName) {
                filters.push({ type: "Experience", name: filterName });
            }
        }
        
        return filters;
    }, [selectedLocations, minYears, maxYears]);

    return (
        <>
            {/* Overlay */}
            <div 
                className={`advanced-filters-overlay ${isOpen ? 'show' : ''}`}
                onClick={onClose}
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    zIndex: 9998,
                    opacity: isOpen ? 1 : 0,
                    visibility: isOpen ? "visible" : "hidden",
                    transition: "opacity 0.3s ease, visibility 0.3s ease",
                }}
            />
            {/* Panel */}
            <div 
                className={`advanced-filters-panel ${isOpen ? 'open' : ''}`}
                style={{
                    position: "fixed",
                    top: 0,
                    right: 0,
                    width: "480px",
                    height: "100vh",
                    backgroundColor: "#FFFFFF",
                    zIndex: 9999,
                    boxShadow: "-2px 0 8px rgba(0, 0, 0, 0.15)",
                    transform: isOpen ? "translateX(0)" : "translateX(100%)",
                    transition: "transform 0.3s ease",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ 
                    background: "var(--Surface-white, #FFFFFF)",
                    borderBottom: "1px solid var(--Colors-Secondary_Colors-Blue-gray-100, #EAECF5)",
                    padding: "24px"
                }}>
                    <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        gap: "10px"
                    }}>
                        <h2 style={{ 
                            fontWeight: 700,
                            fontStyle: "Bold",
                            fontSize: "18px",
                            lineHeight: "28px",
                            letterSpacing: "0%",
                            color: "var(--Text-text-primary, #181D27)",
                            margin: 0
                        }}>Advanced Filters</h2>
                        <button
                            onClick={onClose}
                            style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                width: "28px",
                                height: "28px",
                                padding: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                outline: "none"
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.outline = "none";
                                e.currentTarget.style.border = "none";
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.outline = "none";
                                e.currentTarget.style.border = "none";
                            }}
                            onMouseDown={(e) => {
                                e.currentTarget.style.outline = "none";
                                e.currentTarget.style.border = "none";
                            }}
                            onMouseUp={(e) => {
                                e.currentTarget.style.outline = "none";
                                e.currentTarget.style.border = "none";
                            }}
                        >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M8.83496 0.834961L0.834961 8.83496M0.834961 0.834961L8.83496 8.83496" stroke="#717680" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
                {/* Content Area */}
                <div 
                    ref={contentAreaRef}
                    style={{ 
                        flex: 1,
                        width: "100%",
                        height: "100%",
                        gap: "12px",
                        paddingTop: "16px",
                        paddingRight: "24px",
                        paddingBottom: "16px",
                        paddingLeft: "24px",
                        display: "flex",
                        flexDirection: "column",
                        overflowY: "auto"
                    }}
                >
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        {/* Location Input */}
                        <div className="candidates-input-container" style={{ width: "100%", gap: "8px" }}>
                            <span className="candidates-input-label" style={{
                                fontWeight: 700,
                                fontStyle: "Bold",
                                fontSize: "14px",
                                lineHeight: "20px",
                                letterSpacing: "0%",
                                color: "var(--Text-text-primary, #181D27)"
                            }}>Candidate Location</span>
                            <div 
                                className="candidates-input-wrapper"
                                ref={locationWrapperRef}
                                style={{
                                    boxShadow: "0px 1px 2px 0px #0A0D120D",
                                    border: "1px solid var(--Button-border-primary, #D5D7DA)",
                                    background: "var(--Input-bg-primary, #FFFFFF)"
                                }}
                            >
                                <div className="candidates-input-icon-wrapper">
                                    <img src="/iconsV3/search.svg" alt="Search icon" width={20} height={20} />
                                </div>
                                <input 
                                    ref={locationInputRef}
                                    type="search" 
                                    className="candidates-input-field"
                                    placeholder="Search Locations"
                                    value={locationInput}
                                    onChange={(e) => {
                                        setLocationInput(e.target.value);
                                        setIsLocationDropdownVisible(true);
                                        setFocusedInput("location");
                                    }}
                                    onFocus={(e) => { 
                                        e.target.placeholder = ""; 
                                        setFocusedInput("location");
                                        setIsLocationDropdownVisible(true);
                                    }} 
                                    onBlur={(e) => { 
                                        e.target.placeholder = "Search Locations"; 
                                    }} 
                                />
                                {selectedLocations.length > 0 && (
                                    <div 
                                        className="candidates-input-advanced-filter-count"
                                        style={{
                                            borderRadius: "16px",
                                            borderWidth: "1px",
                                            paddingTop: "2px",
                                            paddingRight: "8px",
                                            paddingBottom: "2px",
                                            paddingLeft: "8px",
                                            background: "var(--Colors-Secondary_Colors-Blue-gray-50, #F8F9FC)",
                                            border: "1px solid var(--Colors-Secondary_Colors-Blue-gray-200, #D5D9EB)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontWeight: 700,
                                                fontStyle: "normal",
                                                fontSize: "12px",
                                                lineHeight: "18px",
                                                letterSpacing: "0%",
                                                textAlign: "center",
                                                color: "var(--Colors-Secondary_Colors-Blue-gray-700, #363F72)",
                                            }}
                                        >
                                            {selectedLocations.length}
                                        </span>
                                    </div>
                                )}
                            </div>
                            {/* Location Tags */}
                            {selectedLocations.length > 0 && (
                                <div className="candidates-filter-tags-container" style={{ padding: 0 }}>
                                    <div className="candidates-filter-tags-content">
                                        {selectedLocations.map((location, index) => (
                                            <div key={`location-${index}`} className="candidates-filter-tag">
                                                <div className="candidates-filter-tag-text">
                                                    <span className="candidates-filter-tag-name">
                                                        {location}
                                                    </span>
                                                </div>
                                                <button
                                                    className="candidates-filter-tag-remove"
                                                    onClick={() => handleRemoveLocation(location)}
                                                    type="button"
                                                    style={{ outline: "none" }}
                                                    onFocus={(e) => {
                                                        e.currentTarget.style.outline = "none";
                                                        e.currentTarget.style.border = "none";
                                                    }}
                                                    onBlur={(e) => {
                                                        e.currentTarget.style.outline = "none";
                                                        e.currentTarget.style.border = "none";
                                                    }}
                                                    onMouseDown={(e) => {
                                                        e.currentTarget.style.outline = "none";
                                                        e.currentTarget.style.border = "none";
                                                    }}
                                                    onMouseUp={(e) => {
                                                        e.currentTarget.style.outline = "none";
                                                        e.currentTarget.style.border = "none";
                                                    }}
                                                >
                                                    <img src="/iconsV3/xV4.svg" alt="Remove" width={7} height={7} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Years of Experience Input */}
                        <div className="candidates-input-container" style={{ width: "100%", gap: "8px" }}>
                            <span className="candidates-input-label" style={{
                                fontWeight: 700,
                                fontStyle: "Bold",
                                fontSize: "14px",
                                lineHeight: "20px",
                                letterSpacing: "0%",
                                color: "var(--Text-text-primary, #181D27)"
                            }}>Years of Experience</span>
                            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "4px", minWidth: 0, width: "100%" }}>
                                <input 
                                    type="text" 
                                    className="candidates-input-field candidates-input-field-years"
                                    placeholder="Minimum" 
                                    value={minYears}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/[^0-9]/g, '');
                                        setMinYears(value);
                                    }}
                                    style={{ 
                                        minWidth: 0, 
                                        borderRadius: "8px", 
                                        border: "1px solid var(--Input-border-primary, #E9EAEB)", 
                                        background: "var(--Input-bg-primary, #FFFFFF)", 
                                        padding: "10px 14px", 
                                        height: "44px",
                                        boxShadow: "0px 1px 2px 0px #0A0D120D"
                                    }} 
                                    onFocus={(e) => { e.target.placeholder = ""; setFocusedInput("minYears"); }} 
                                    onBlur={(e) => { e.target.placeholder = "Minimum"; setFocusedInput(null); }} 
                                />
                                <div style={{ width: "16px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <div style={{ width: "100%", height: "0px", border: "1px solid var(--Border-primary, #E9EAEB)", opacity: 1 }}></div>
                                </div>
                                <input 
                                    type="text" 
                                    className="candidates-input-field candidates-input-field-years"
                                    placeholder="Maximum" 
                                    value={maxYears}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/[^0-9]/g, '');
                                        setMaxYears(value);
                                    }}
                                    style={{ 
                                        minWidth: 0, 
                                        borderRadius: "8px", 
                                        border: "1px solid var(--Input-border-primary, #E9EAEB)", 
                                        background: "var(--Input-bg-primary, #FFFFFF)", 
                                        padding: "10px 14px", 
                                        height: "44px",
                                        boxShadow: "0px 1px 2px 0px #0A0D120D"
                                    }} 
                                    onFocus={(e) => { e.target.placeholder = ""; setFocusedInput("maxYears"); }} 
                                    onBlur={(e) => { e.target.placeholder = "Maximum"; setFocusedInput(null); }} 
                                />
                            </div>
                            {/* Experience Tags */}
                            {(minYears.trim() || maxYears.trim()) && (() => {
                                const min = minYears.trim();
                                const max = maxYears.trim();
                                let filterName = "";
                                
                                if (min && max) {
                                    filterName = `${min}-${max} years`;
                                } else if (min) {
                                    filterName = `${min}≥ years`;
                                } else if (max) {
                                    filterName = `${max}≤ years`;
                                }
                                
                                if (!filterName) return null;
                                
                                return (
                                    <div className="candidates-filter-tags-container" style={{ padding: 0 }}>
                                        <div className="candidates-filter-tags-content">
                                            <div className="candidates-filter-tag">
                                                <div className="candidates-filter-tag-text">
                                                    <span className="candidates-filter-tag-name">
                                                        {filterName}
                                                    </span>
                                                </div>
                                                <button
                                                    className="candidates-filter-tag-remove"
                                                    onClick={() => {
                                                        setMinYears("");
                                                        setMaxYears("");
                                                    }}
                                                    type="button"
                                                    style={{ outline: "none" }}
                                                    onFocus={(e) => {
                                                        e.currentTarget.style.outline = "none";
                                                        e.currentTarget.style.border = "none";
                                                    }}
                                                    onBlur={(e) => {
                                                        e.currentTarget.style.outline = "none";
                                                        e.currentTarget.style.border = "none";
                                                    }}
                                                    onMouseDown={(e) => {
                                                        e.currentTarget.style.outline = "none";
                                                        e.currentTarget.style.border = "none";
                                                    }}
                                                    onMouseUp={(e) => {
                                                        e.currentTarget.style.outline = "none";
                                                        e.currentTarget.style.border = "none";
                                                    }}
                                                >
                                                    <img src="/iconsV3/xV4.svg" alt="Remove" width={7} height={7} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                        {/* Pre-Screening Questions */}
                        {preScreeningQuestions.map((question, index) => {
                            const questionId = question.id;
                            const questionType = question.questionType;
                            // Create a unique key based on question content to avoid duplicate keys
                            // Use question text, format, and index to ensure uniqueness
                            // This is critical because the same question from different careers might have the same ID
                            const uniqueKey = `${question.question}-${question.questionFormat}-${index}`;
                            // Use uniqueKey for state management instead of questionId to prevent collisions
                            const isDropdownOpen = preScreeningDropdownsOpen[uniqueKey] || false;
                            const currentAnswer = preScreeningAnswers[uniqueKey];

                            // Render based on question format
                            if (question.questionFormat === "Range") {
                                // Range input (min-max)
                                const minValue = currentAnswer?.min || "";
                                const maxValue = currentAnswer?.max || "";
                                
                                return (
                                    <div key={uniqueKey} className="candidates-input-container" style={{ width: "100%", gap: "8px" }}>
                                        <span className="candidates-input-label" style={{
                                            fontWeight: 700,
                                            fontStyle: "Bold",
                                            fontSize: "14px",
                                            lineHeight: "20px",
                                            letterSpacing: "0%",
                                            color: "var(--Text-text-primary, #181D27)"
                                        }}>{question.question}</span>
                                        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "4px", minWidth: 0, width: "100%" }}>
                                            <input 
                                                type="text" 
                                                className="candidates-input-field candidates-input-field-years"
                                                placeholder="Minimum" 
                                                value={minValue}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/[^0-9]/g, '');
                                                    setPreScreeningAnswers(prev => ({
                                                        ...prev,
                                                        [uniqueKey]: { ...prev[uniqueKey], min: value }
                                                    }));
                                                }}
                                                style={{ 
                                                    minWidth: 0, 
                                                    borderRadius: "8px", 
                                                    border: "1px solid var(--Input-border-primary, #E9EAEB)", 
                                                    background: "var(--Input-bg-primary, #FFFFFF)", 
                                                    padding: "10px 14px", 
                                                    height: "44px",
                                                    boxShadow: "0px 1px 2px 0px #0A0D120D"
                                                }} 
                                                onFocus={(e) => { e.target.placeholder = ""; }} 
                                                onBlur={(e) => { e.target.placeholder = "Minimum"; }} 
                                            />
                                            <div style={{ width: "16px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                <div style={{ width: "100%", height: "0px", border: "1px solid var(--Border-primary, #E9EAEB)", opacity: 1 }}></div>
                                            </div>
                                            <input 
                                                type="text" 
                                                className="candidates-input-field candidates-input-field-years"
                                                placeholder="Maximum" 
                                                value={maxValue}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/[^0-9]/g, '');
                                                    setPreScreeningAnswers(prev => ({
                                                        ...prev,
                                                        [uniqueKey]: { ...prev[uniqueKey], max: value }
                                                    }));
                                                }}
                                                style={{ 
                                                    minWidth: 0, 
                                                    borderRadius: "8px", 
                                                    border: "1px solid var(--Input-border-primary, #E9EAEB)", 
                                                    background: "var(--Input-bg-primary, #FFFFFF)", 
                                                    padding: "10px 14px", 
                                                    height: "44px",
                                                    boxShadow: "0px 1px 2px 0px #0A0D120D"
                                                }} 
                                                onFocus={(e) => { e.target.placeholder = ""; }} 
                                                onBlur={(e) => { e.target.placeholder = "Maximum"; }} 
                                            />
                                        </div>
                                        {(minValue || maxValue) && (
                                            <div className="candidates-filter-tags-container" style={{ padding: 0 }}>
                                                <div className="candidates-filter-tags-content">
                                                    <div className="candidates-filter-tag">
                                                        <div className="candidates-filter-tag-text">
                                                            <span className="candidates-filter-tag-name">
                                                                {minValue && maxValue ? `${minValue}-${maxValue}` : minValue ? `${minValue}≥` : `${maxValue}≤`}
                                                            </span>
                                                        </div>
                                                        <button
                                                            className="candidates-filter-tag-remove"
                                                            onClick={() => {
                                                                setPreScreeningAnswers(prev => {
                                                                    const updated = { ...prev };
                                                                    delete updated[uniqueKey];
                                                                    return updated;
                                                                });
                                                            }}
                                                            type="button"
                                                            style={{ outline: "none" }}
                                                            onFocus={(e) => {
                                                                e.currentTarget.style.outline = "none";
                                                                e.currentTarget.style.border = "none";
                                                            }}
                                                            onBlur={(e) => {
                                                                e.currentTarget.style.outline = "none";
                                                                e.currentTarget.style.border = "none";
                                                            }}
                                                            onMouseDown={(e) => {
                                                                e.currentTarget.style.outline = "none";
                                                                e.currentTarget.style.border = "none";
                                                            }}
                                                            onMouseUp={(e) => {
                                                                e.currentTarget.style.outline = "none";
                                                                e.currentTarget.style.border = "none";
                                                            }}
                                                        >
                                                            <img src="/iconsV3/xV4.svg" alt="Remove" width={7} height={7} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            } else if (question.questionFormat === "Dropdown" || question.questionFormat === "Checkboxes") {
                                // Dropdown or Checkboxes (multi-select)
                                const selectedValues = Array.isArray(currentAnswer) ? currentAnswer : (currentAnswer ? [currentAnswer] : []);
                                const isMultiSelect = question.questionFormat === "Checkboxes";
                                
                                return (
                                    <div key={uniqueKey} className="candidates-input-container" style={{ width: "100%", gap: "8px" }}>
                                        <span className="candidates-input-label" style={{
                                            fontWeight: 700,
                                            fontStyle: "Bold",
                                            fontSize: "14px",
                                            lineHeight: "20px",
                                            letterSpacing: "0%",
                                            color: "var(--Text-text-primary, #181D27)"
                                        }}>{question.question}</span>
                                        <div 
                                            className="dropdown w-100" 
                                            style={{ 
                                                display: "flex", 
                                                flexDirection: "column", 
                                                alignItems: "flex-start", 
                                                position: "relative",
                                                width: "100%",
                                                zIndex: isDropdownOpen ? 1000 : "auto"
                                            }}
                                        >
                                            <button
                                                ref={(el) => {
                                                    if (el) {
                                                        preScreeningButtonRefs.current[uniqueKey] = el;
                                                    } else {
                                                        delete preScreeningButtonRefs.current[uniqueKey];
                                                    }
                                                }}
                                                className="dropdown-btn fade-in-bottom"
                                                style={{ 
                                                    width: "100%", 
                                                    color: "#181D27", 
                                                    border: "1px solid #D5D7DA",
                                                    height: "44px",
                                                    borderRadius: "8px",
                                                    padding: "10px 14px",
                                                    outline: "none",
                                                    boxShadow: "0px 1px 2px 0px #0A0D120D",
                                                    position: "relative",
                                                    zIndex: 1
                                                }}
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const newValue = !isDropdownOpen;
                                                    
                                                    // Calculate position if opening
                                                    if (newValue) {
                                                        const buttonRef = preScreeningButtonRefs.current[uniqueKey];
                                                        if (buttonRef) {
                                                            requestAnimationFrame(() => {
                                                                const buttonRect = buttonRef.getBoundingClientRect();
                                                                const dropdownMaxHeight = 200;
                                                                const gap = 4;
                                                                // Prefer using the scrollable content area as the parent container
                                                                const container = contentAreaRef.current;

                                                                let spaceBelow: number;
                                                                let spaceAbove: number;

                                                                if (container) {
                                                                    const containerRect = container.getBoundingClientRect();
                                                                    // Space between bottom of button and bottom of container
                                                                    spaceBelow = containerRect.bottom - buttonRect.bottom - gap;
                                                                    // Space between top of container and top of button
                                                                    spaceAbove = buttonRect.top - containerRect.top - gap;
                                                                } else {
                                                                    // Fallback to viewport if container is not available
                                                                    const viewportHeight = window.innerHeight;
                                                                    spaceBelow = viewportHeight - buttonRect.bottom - gap;
                                                                    spaceAbove = buttonRect.top - gap;
                                                                }

                                                                const shouldPositionAbove = spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow;
                                                                
                                                                setPreScreeningDropdownPositions(prev => ({
                                                                    ...prev,
                                                                    [uniqueKey]: { positionAbove: shouldPositionAbove }
                                                                }));
                                                            });
                                                        }
                                                    }
                                                    
                                                    // Close all other dropdowns first
                                                    setPreScreeningDropdownsOpen(prev => {
                                                        const newState: Record<string, boolean> = {};
                                                        // Close all others, toggle this one
                                                        newState[uniqueKey] = newValue;
                                                        return newState;
                                                    });
                                                }}
                                                onFocus={(e) => {
                                                    e.currentTarget.style.outline = "none";
                                                    e.currentTarget.style.border = "1px solid #D5D7DA";
                                                }}
                                                onBlur={(e) => {
                                                    e.currentTarget.style.outline = "none";
                                                    e.currentTarget.style.border = "1px solid #D5D7DA";
                                                }}
                                                onMouseDown={(e) => {
                                                    e.currentTarget.style.outline = "none";
                                                    e.currentTarget.style.border = "1px solid #D5D7DA";
                                                }}
                                                onMouseUp={(e) => {
                                                    e.currentTarget.style.outline = "none";
                                                    e.currentTarget.style.border = "1px solid #D5D7DA";
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.border = "1px solid #D5D7DA";
                                                    e.currentTarget.style.backgroundColor = "#F7F8F9";
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.border = "1px solid #D5D7DA";
                                                    e.currentTarget.style.backgroundColor = "transparent";
                                                }}
                                            >
                                                <span style={{
                                                    fontWeight: 500,
                                                    fontStyle: "Medium",
                                                    fontSize: "16px",
                                                    lineHeight: "24px",
                                                    letterSpacing: "0%",
                                                    color: selectedValues.length > 0 
                                                        ? "var(--Input-text-primary, #181D27)"
                                                        : "var(--Input-text-placeholder-or-disabled, #717680)"
                                                }}>
                                                    {selectedValues.length > 0 
                                                        ? isMultiSelect 
                                                            ? `${selectedValues.length} selected`
                                                            : selectedValues[0]
                                                        : "Select..."}
                                                </span>
                                                <i className="la la-angle-down ml-10"></i>
                                            </button>
                                            {isDropdownOpen && (() => {
                                                const dropdownPosition = preScreeningDropdownPositions[uniqueKey];
                                                const positionAbove = dropdownPosition?.positionAbove || false;
                                                
                                                return (
                                                    <div
                                                        data-prescreening-dropdown={uniqueKey}
                                                        className="dropdown-menu show"
                                                        style={{
                                                            padding: 0,
                                                            maxHeight: 200,
                                                            overflowY: "auto",
                                                            width: "100%",
                                                            position: "absolute",
                                                            ...(positionAbove 
                                                                ? { 
                                                                    bottom: "calc(100% + 4px)",
                                                                    top: "auto"
                                                                } 
                                                                : { 
                                                                    top: "calc(100% + 4px)",
                                                                    bottom: "auto"
                                                                }
                                                            ),
                                                            left: 0,
                                                            right: 0,
                                                            zIndex: 1001,
                                                            backgroundColor: "#FFFFFF",
                                                            boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
                                                            borderRadius: "8px",
                                                            margin: 0,
                                                        }}
                                                    >
                                                    {question.answers && question.answers.length > 0 ? (
                                                        question.answers.map((answer, index) => {
                                                            const answerValue = String(answer.value);
                                                            const isSelected = selectedValues.includes(answerValue);

                                                            return (
                                                                <div key={`${uniqueKey}-answer-${index}`}>
                                                                    <button
                                                                        className="dropdown-item d-flex align-items-center"
                                                                        style={{
                                                                            width: "100%",
                                                                            borderRadius: isSelected ? 0 : 10,
                                                                            overflow: "hidden",
                                                                            paddingBottom: 10,
                                                                            paddingTop: 10,
                                                                            color: "#181D27",
                                                                            fontWeight: isSelected ? 700 : 500,
                                                                            background: isSelected ? "#F8F9FC" : "transparent",
                                                                            display: "flex",
                                                                            flexDirection: "row",
                                                                            justifyContent: "space-between",
                                                                            alignItems: "center",
                                                                            whiteSpace: "wrap",
                                                                            border: "none",
                                                                            outline: "none",
                                                                        }}
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            if (isMultiSelect) {
                                                                                setPreScreeningAnswers(prev => {
                                                                                    const current = Array.isArray(prev[uniqueKey]) ? prev[uniqueKey] : [];
                                                                                    if (current.includes(answerValue)) {
                                                                                        return {
                                                                                            ...prev,
                                                                                            [uniqueKey]: current.filter((v: any) => v !== answerValue)
                                                                                        };
                                                                                    } else {
                                                                                        return {
                                                                                            ...prev,
                                                                                            [uniqueKey]: [...current, answerValue]
                                                                                        };
                                                                                    }
                                                                                });
                                                                            } else {
                                                                                setPreScreeningAnswers(prev => ({
                                                                                    ...prev,
                                                                                    [uniqueKey]: answerValue
                                                                                }));
                                                                                setPreScreeningDropdownsOpen(prev => ({ ...prev, [uniqueKey]: false }));
                                                                            }
                                                                        }}
                                                                    >
                                                                        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
                                                                            {answerValue}
                                                                        </div>
                                                                        {isSelected && (
                                                                            <i
                                                                                className="la la-check"
                                                                                style={{
                                                                                    fontSize: "20px",
                                                                                    background: "linear-gradient(180deg, #9FCAED 0%, #CEB6DA 33%, #EBACC9 66%, #FCCEC0 100%)",
                                                                                    WebkitBackgroundClip: "text",
                                                                                    WebkitTextFillColor: "transparent",
                                                                                    backgroundClip: "text",
                                                                                    color: "transparent",
                                                                                    marginRight: 0
                                                                                }}
                                                                            ></i>
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div style={{ padding: "10px", color: "#717680", textAlign: "center" }}>
                                                            No options available
                                                        </div>
                                                    )}
                                                </div>
                                                );
                                            })()}
                                        </div>
                                        {selectedValues.length > 0 && (
                                            <div className="candidates-filter-tags-container" style={{ padding: 0 }}>
                                                <div className="candidates-filter-tags-content">
                                                    {selectedValues.map((value, index) => (
                                                        <div key={`${uniqueKey}-tag-${index}`} className="candidates-filter-tag">
                                                            <div className="candidates-filter-tag-text">
                                                                <span className="candidates-filter-tag-name">
                                                                    {String(value)}
                                                                </span>
                                                            </div>
                                                            <button
                                                                className="candidates-filter-tag-remove"
                                                                onClick={() => {
                                                                    if (isMultiSelect) {
                                                                        setPreScreeningAnswers(prev => ({
                                                                            ...prev,
                                                                            [uniqueKey]: (prev[uniqueKey] || []).filter((v: any) => v !== value)
                                                                        }));
                                                                    } else {
                                                                        setPreScreeningAnswers(prev => {
                                                                            const updated = { ...prev };
                                                                            delete updated[uniqueKey];
                                                                            return updated;
                                                                        });
                                                                    }
                                                                }}
                                                                type="button"
                                                                style={{ outline: "none" }}
                                                                onFocus={(e) => {
                                                                    e.currentTarget.style.outline = "none";
                                                                    e.currentTarget.style.border = "none";
                                                                }}
                                                                onBlur={(e) => {
                                                                    e.currentTarget.style.outline = "none";
                                                                    e.currentTarget.style.border = "none";
                                                                }}
                                                                onMouseDown={(e) => {
                                                                    e.currentTarget.style.outline = "none";
                                                                    e.currentTarget.style.border = "none";
                                                                }}
                                                                onMouseUp={(e) => {
                                                                    e.currentTarget.style.outline = "none";
                                                                    e.currentTarget.style.border = "none";
                                                                }}
                                                            >
                                                                <img src="/iconsV3/xV4.svg" alt="Remove" width={7} height={7} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            } else {
                                // Short Answer or Long Answer (text input)
                                const textValue = currentAnswer || "";
                                
                                return (
                                    <div key={uniqueKey} className="candidates-input-container" style={{ width: "100%", gap: "8px" }}>
                                        <span className="candidates-input-label" style={{
                                            fontWeight: 700,
                                            fontStyle: "Bold",
                                            fontSize: "14px",
                                            lineHeight: "20px",
                                            letterSpacing: "0%",
                                            color: "var(--Text-text-primary, #181D27)"
                                        }}>{question.question}</span>
                                        <input 
                                            type="text" 
                                            className="candidates-input-field candidates-input-field-years"
                                            placeholder={question.questionFormat === "Long Answer" ? "Enter your answer..." : "Enter your answer..."}
                                            value={textValue}
                                            onChange={(e) => {
                                                setPreScreeningAnswers(prev => ({
                                                    ...prev,
                                                    [uniqueKey]: e.target.value
                                                }));
                                            }}
                                            style={{ 
                                                width: "100%", 
                                                borderRadius: "8px", 
                                                border: "1px solid var(--Input-border-primary, #E9EAEB)", 
                                                background: "var(--Input-bg-primary, #FFFFFF)", 
                                                padding: "10px 14px", 
                                                height: question.questionFormat === "Long Answer" ? "88px" : "44px",
                                                boxShadow: "0px 1px 2px 0px #0A0D120D"
                                            }} 
                                        />
                                        {textValue && (
                                            <div className="candidates-filter-tags-container" style={{ padding: 0 }}>
                                                <div className="candidates-filter-tags-content">
                                                    <div className="candidates-filter-tag">
                                                        <div className="candidates-filter-tag-text">
                                                            <span className="candidates-filter-tag-name">
                                                                {textValue}
                                                            </span>
                                                        </div>
                                                        <button
                                                            className="candidates-filter-tag-remove"
                                                            onClick={() => {
                                                                setPreScreeningAnswers(prev => {
                                                                    const updated = { ...prev };
                                                                    delete updated[uniqueKey];
                                                                    return updated;
                                                                });
                                                            }}
                                                            type="button"
                                                            style={{ outline: "none" }}
                                                            onFocus={(e) => {
                                                                e.currentTarget.style.outline = "none";
                                                                e.currentTarget.style.border = "none";
                                                            }}
                                                            onBlur={(e) => {
                                                                e.currentTarget.style.outline = "none";
                                                                e.currentTarget.style.border = "none";
                                                            }}
                                                            onMouseDown={(e) => {
                                                                e.currentTarget.style.outline = "none";
                                                                e.currentTarget.style.border = "none";
                                                            }}
                                                            onMouseUp={(e) => {
                                                                e.currentTarget.style.outline = "none";
                                                                e.currentTarget.style.border = "none";
                                                            }}
                                                        >
                                                            <img src="/iconsV3/xV4.svg" alt="Remove" width={7} height={7} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                        })}
                    </div>
                </div>
                {/* Footer */}
                <div style={{ 
                    gap: "16px",
                    borderTop: "1px solid var(--Colors-Secondary_Colors-Blue-gray-100, #EAECF5)",
                    padding: "24px",
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    position: "relative",
                    zIndex: 1
                }}>
                    <button
                        onClick={handleClearFilters}
                        style={{
                            flex: 1,
                            gap: "8px",
                            paddingTop: "10px",
                            paddingRight: "16px",
                            paddingBottom: "10px",
                            paddingLeft: "16px",
                            borderRadius: "50px",
                            borderWidth: "1px",
                            border: "1px solid var(--Border-primary, #E9EAEB)",
                            background: "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "background-color 0.2s ease"
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#F7F8F9";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                        }}
                    >
                        <span style={{
                            fontWeight: 700,
                            fontStyle: "Bold",
                            fontSize: "14px",
                            lineHeight: "20px",
                            letterSpacing: "0%",
                            color: "var(--Button-text-secondary, #414651)"
                        }}>
                            Clear Filters
                        </span>
                    </button>
                    <button
                        onClick={handleApplyFilters}
                        style={{
                            flex: 1,
                            gap: "8px",
                            paddingTop: "10px",
                            paddingRight: "16px",
                            paddingBottom: "10px",
                            paddingLeft: "16px",
                            borderRadius: "50px",
                            borderWidth: "1px",
                            background: "var(--Button-bg-primary, #181D27)",
                            border: "1px solid var(--Button-bg-primary, #181D27)",
                            boxShadow: "0px 1px 2px 0px #0A0D120D",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer"
                        }}
                    >
                        <span style={{
                            fontWeight: 700,
                            fontStyle: "Bold",
                            fontSize: "14px",
                            lineHeight: "20px",
                            letterSpacing: "0%",
                            color: "var(--Button-text-primary, #FFFFFF)"
                        }}>
                            Apply Filters
                        </span>
                    </button>
                </div>
            </div>
            {/* LocationDropdown - placed outside scrollable area for proper positioning */}
            <LocationDropdown 
                isVisible={isLocationDropdownVisible || focusedInput === "location"}
                wrapperRef={locationWrapperRef}
                dropdownRef={locationDropdownRef}
                searchQuery={locationInput}
                locationData={effectiveLocationData}
                isLoading={isLoadingLocationSuggestions}
                onItemSelect={handleLocationSelect}
                zIndex={10000}
            />
        </>
    );
}

