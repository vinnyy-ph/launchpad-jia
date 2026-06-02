import React from "react";

interface AiSearchButtonProps {
    onClick: () => void;
    isActive: boolean;
}

export default function AiSearchButton({ onClick, isActive }: AiSearchButtonProps) {
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
            <div style={{ width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" fill="#535862"></path>
                    <path d="M19 3L20 6L23 7L20 8L19 11L18 8L15 7L18 6L19 3Z" fill="#535862"></path>
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
                AI Search
            </span>
        </button>
    );
}
