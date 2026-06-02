"use client";

import React, { ReactNode } from "react";

interface SkillTagProps {
    label: string;
    isHighlighted?: boolean;
    showThumb?: boolean;
    size?: "sm" | "md";
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    children?: ReactNode;
}

export const SkillTag: React.FC<SkillTagProps> = ({
    label,
    isHighlighted = false,
    showThumb = false,
    size = "md",
    onClick,
    onMouseEnter,
    onMouseLeave,
    children,
}) => {
    const isEndorsed = isHighlighted && showThumb;
    const isLight = isHighlighted && !showThumb;

    const backgroundColor = isEndorsed ? "#175cd3ff" : isLight ? "#EFF6FF" : "#F8F9FC";
    const borderColor = isEndorsed ? "#175CD3" : isLight ? "#D1E2FF" : "#D5D9EB";
    const textColor = isEndorsed ? "#FFFFFF" : isLight ? "#175CD3" : "#363F72";
    const thumbColor = isEndorsed ? "#FFFFFF" : "#2E90FA";

    const padding = size === "sm" ? "2px 9px" : "4px 10px";
    const fontSize = size === "sm" ? "12px" : "14px";
    const gap = size === "sm" ? "3px" : "4px";
    const thumbSize = size === "sm" ? 16 : 18;
    const labelMaxWidth = size === "sm" ? "20ch" : "25ch";

    return (
        <span
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{
                padding,
                backgroundColor,
                border: `1px solid ${borderColor}`,
                borderRadius: "6px",
                fontSize,
                fontWeight: 500,
                color: textColor,
                whiteSpace: "nowrap",
                cursor: onClick ? "pointer" : "default",
                display: "inline-flex",
                alignItems: "center",
                gap,
                position: "relative",
                outline: "none",
                boxShadow: "none",
                lineHeight: 1,
                alignSelf: "flex-start",
                maxWidth: "100%",
                minWidth: 0,
                overflow: "visible",
            }}
        >
            <span
                style={{
                    lineHeight: 1,
                    display: "block",
                    flex: "0 1 auto",
                    minWidth: 0,
                    maxWidth: labelMaxWidth,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                {label}
            </span>
            {showThumb && (
                <span
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: thumbSize,
                        height: thumbSize,
                        color: "#175cd3ff",
                        marginTop: "-1px",
                        flex: "0 0 auto",
                    }}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="#a1bef0ff"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ display: "block" }}
                    >
                        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
                        <path d="M7 10v12" />
                    </svg>
                </span>
            )}
            {children}
        </span>
    );
};
