import React from "react";

interface AdvancedFiltersButtonProps {
    onClick: () => void;
    filterCount: number;
}

/**
 * Advanced Filters button component
 * Extracted from CandidatesTableV2 for better organization
 */
export default function AdvancedFiltersButton({ onClick, filterCount }: AdvancedFiltersButtonProps) {
    const handleFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
        e.currentTarget.style.outline = "none";
        e.currentTarget.style.border = "1px solid var(--Border-primary, #E9EAEB)";
    };

    const handleBlur = (e: React.FocusEvent<HTMLButtonElement>) => {
        e.currentTarget.style.outline = "none";
        e.currentTarget.style.border = "1px solid var(--Border-primary, #E9EAEB)";
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.outline = "none";
        e.currentTarget.style.border = "1px solid var(--Border-primary, #E9EAEB)";
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.outline = "none";
        e.currentTarget.style.border = "1px solid var(--Border-primary, #E9EAEB)";
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.backgroundColor = "#F7F8F9";
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.backgroundColor = "transparent";
    };

    return (
        <button
            onClick={onClick}
            className="button-v2 secondary"
            onFocus={handleFocus}
            onBlur={handleBlur}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div style={{ width: "17px", height: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="17" height="12" viewBox="0 0 17 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M3.33496 5.83496H13.335M0.834961 0.834961H15.835M5.83496 10.835H10.835"
                        stroke="#535862"
                        strokeWidth="1.67"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>
            <span
                style={{
                    fontWeight: 700,
                    fontStyle: "Bold",
                    fontSize: "14px",
                    lineHeight: "20px",
                    letterSpacing: "0%",
                    color: "var(--Button-text-secondary, #414651)",
                }}
            >
                Advanced Filters
            </span>
            {filterCount > 0 && (
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
                        {filterCount}
                    </span>
                </div>
            )}
        </button>
    );
}

